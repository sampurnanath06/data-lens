import type { NetworkEvent } from '../types';
import { getRegistrableDomain } from '../utils/domain';
import { saveNetworkEvent } from '../storage/storage';
import { classify } from '../classifier/classifier';

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
  try {
    const event = toThirdPartyEvent(details);
    if (!event) return;

    saveNetworkEvent(event).catch((error) => {
      console.error('[request-observer] Failed to save network event', error);
    });
  } catch (error) {
    // Metadata extraction must never take down the listener — a single
    // malformed request should not stop future requests from being observed.
    console.error('[request-observer] Failed to process request', error);
  }
}

function toThirdPartyEvent(details: chrome.webRequest.WebRequestBodyDetails): NetworkEvent | null {
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

  return {
    id: crypto.randomUUID(),
    sourceSite,
    destinationDomain,
    requestType: details.type,
    timestamp: Math.floor(details.timeStamp),
    isThirdParty: true,
    category,
    knownTracker,
    // Risk signals land in a later phase.
    riskSignals: [],
    blocked: false,
  };
}
