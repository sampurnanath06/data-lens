import type { NetworkEvent, RiskSignal } from '../types';
import { getRegistrableDomain } from '../utils/domain';
import {
  getBlockedDestinations,
  getCrossSiteMap,
  recordCrossSiteContact,
  saveNetworkEvent,
} from '../storage/storage';
import { classify } from '../classifier/classifier';
import {
  buildCrossSitePresenceSignal,
  buildKnownTrackerSignal,
  detectTrackingParameterSignals,
} from '../classifier/risk-signals';

// Observation only (CLAUDE.md 6.4) — chrome.webRequest is never used to
// block here. Blocking is a separate, later concern handled through
// declarativeNetRequest.
//
// main_frame requests are the page navigation itself, not a third party the
// already-loaded page is talking to, so there is no meaningful "source site"
// for one and it is excluded.
const IGNORED_REQUEST_TYPES = new Set<string>(['main_frame']);

/**
 * Registers the webRequest observer. Must be called synchronously from the
 * top level of the service worker (CLAUDE.md 6.2) — registering it lazily or
 * after an await means it silently stops firing once the worker is
 * terminated and restarted.
 */
export function registerRequestObserver(): void {
  chrome.webRequest.onBeforeRequest.addListener(handleBeforeRequest, { urls: ['<all_urls>'] });
}

function handleBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails): void {
  toThirdPartyEvent(details)
    .then((event) => {
      if (!event) return;
      return saveNetworkEvent(event);
    })
    .catch((error) => {
      // Metadata extraction and storage must never take down the listener —
      // a single malformed or failed request should not stop future
      // requests from being observed.
      console.error('[request-observer] Failed to process request', error);
    });
}

async function toThirdPartyEvent(
  details: chrome.webRequest.WebRequestBodyDetails,
): Promise<NetworkEvent | null> {
  if (IGNORED_REQUEST_TYPES.has(details.type)) return null;

  // No initiator (or an opaque "null" initiator) means the originating page
  // can't be determined — drop rather than guess a source site.
  if (!details.initiator || details.initiator === 'null') return null;

  const sourceSite = getRegistrableDomain(details.initiator);
  const destinationDomain = getRegistrableDomain(details.url);
  if (!sourceSite || !destinationDomain) return null;

  const isThirdParty = sourceSite !== destinationDomain;
  if (!isThirdParty) return null;

  const { category, knownTracker } = classify(destinationDomain);
  const [riskSignals, blockedDestinations] = await Promise.all([
    computeRiskSignals(details.url, destinationDomain, sourceSite, knownTracker),
    getBlockedDestinations(),
  ]);

  return {
    id: crypto.randomUUID(),
    sourceSite,
    destinationDomain,
    requestType: details.type,
    timestamp: Math.floor(details.timeStamp),
    isThirdParty: true,
    category,
    knownTracker,
    riskSignals,
    // declarativeNetRequest blocks the request after this event is already
    // being recorded (onBeforeRequest fires regardless of what happens
    // next), so this reflects "was this destination blocked at the time of
    // this attempt" rather than "did this specific request complete."
    blocked: blockedDestinations.includes(destinationDomain),
  };
}

async function computeRiskSignals(
  url: string,
  destinationDomain: string,
  sourceSite: string,
  knownTracker: boolean,
): Promise<RiskSignal[]> {
  // The cross-site map is persisted through the storage module (CLAUDE.md
  // 6.3) — nothing about "which sites have contacted this destination"
  // lives only in this module's memory, so a service worker restart never
  // loses it.
  await recordCrossSiteContact(destinationDomain, sourceSite);
  const crossSiteMap = await getCrossSiteMap();
  const sourceSiteCount = crossSiteMap[destinationDomain]?.length ?? 0;

  return [
    ...detectTrackingParameterSignals(url),
    ...buildKnownTrackerSignal(knownTracker),
    ...buildCrossSitePresenceSignal(sourceSiteCount),
  ];
}
