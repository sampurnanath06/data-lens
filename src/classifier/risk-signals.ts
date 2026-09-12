import type { RiskSignal } from '../types';

// Exactly the three signals in CLAUDE.md section 9 — no others. In
// particular, no third-party cookie detection: it's explicitly out of
// scope (fragile extraHeaders handling, shifting Chrome cookie behavior).

// fbclid/gclid are exact known tracking-parameter names; any `utm_*` param
// counts regardless of its suffix. This only records that a parameter with
// this name was present in the URL — it never labels the URL malicious.
const EXACT_TRACKING_PARAM_NAMES = new Set(['fbclid', 'gclid']);
const UTM_PARAM_PREFIX = 'utm_';

const CROSS_SITE_PRESENCE_THRESHOLD = 2;

/**
 * Detects known tracking-parameter names in a request URL. One signal per
 * distinct parameter found (structured, not a blob) — e.g. a URL carrying
 * both `gclid` and `utm_source` produces two signals.
 */
export function detectTrackingParameterSignals(url: string): RiskSignal[] {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    // Malformed URL metadata — nothing to detect, not an error to surface.
    return [];
  }

  const found = new Set<string>();
  for (const name of params.keys()) {
    if (EXACT_TRACKING_PARAM_NAMES.has(name) || name.startsWith(UTM_PARAM_PREFIX)) {
      found.add(name);
    }
  }

  return [...found].map((detail) => ({ kind: 'tracking_parameter' as const, detail }));
}

/** Emitted when the dataset lookup (classifier) says this is a known tracker. */
export function buildKnownTrackerSignal(knownTracker: boolean): RiskSignal[] {
  return knownTracker ? [{ kind: 'known_tracker' }] : [];
}

/**
 * Emitted once a destination has actually been observed on 2+ distinct
 * source sites this session. `sourceSiteCount` must come from the
 * persisted cross-site map (CLAUDE.md section 6.3) — never a value derived
 * from in-memory state alone, since that gets wiped on every service
 * worker restart.
 */
export function buildCrossSitePresenceSignal(sourceSiteCount: number): RiskSignal[] {
  if (sourceSiteCount < CROSS_SITE_PRESENCE_THRESHOLD) return [];
  return [{ kind: 'cross_site_presence', detail: `seen on ${sourceSiteCount} sites` }];
}
