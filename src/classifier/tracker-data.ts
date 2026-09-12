import trackerDomains from '../../data/whotracks/trackers.json';
import type { Category } from '../types';

// Bundled directly (not fetched at runtime) so lookup never stalls service
// worker startup — see data/whotracks/README.md for size and generation
// details. `trackers.json` is `{ registrableDomain: rawCategoryName }`,
// generated from the WhoTracks.me / Ghostery TrackerDB dataset.
const DOMAIN_CATEGORY: Record<string, string> = trackerDomains;

// Sanity floor, not a precise count — the real dataset has ~4,750 entries.
// This exists purely to catch a build-time regression (e.g. the JSON import
// silently resolving to `{}`, or someone later turning this into an async
// load without updating classify() to wait for it) that would otherwise
// manifest as silent, hard-to-trace "everything is Unknown" behavior.
const MIN_EXPECTED_DOMAIN_COUNT = 1000;
const DATASET_READY = Object.keys(DOMAIN_CATEGORY).length >= MIN_EXPECTED_DOMAIN_COUNT;

if (!DATASET_READY) {
  console.error(
    `[classifier] Tracker dataset failed to load correctly ` +
      `(${Object.keys(DOMAIN_CATEGORY).length} entries, expected >= ${MIN_EXPECTED_DOMAIN_COUNT}). ` +
      `classify() will return Unknown for every domain until this is fixed.`,
  );
}

export function isTrackerDatasetReady(): boolean {
  return DATASET_READY;
}

// Maps the dataset's own category names onto our Category union. This is
// the only place that translation happens — do not invent categories the
// dataset doesn't contain (CLAUDE.md section 8). Every raw category the
// dataset currently defines is listed here explicitly; an unrecognized
// future category falls back to 'Other' in lookupTrackerCategory rather
// than being guessed at.
const RAW_CATEGORY_TO_CATEGORY: Record<string, Category> = {
  advertising: 'Advertising',
  pornvertising: 'Advertising',
  site_analytics: 'Analytics',
  social_media: 'Social',
  // "hosting" covers CDN/infrastructure providers (Cloudflare, Akamai,
  // Amazon CloudFront, etc.) in this dataset.
  hosting: 'CDN',
  audio_video_player: 'Other',
  consent: 'Other',
  customer_interaction: 'Other',
  extensions: 'Other',
  misc: 'Other',
  utilities: 'Other',
};

/**
 * Looks up a registrable domain against the bundled tracker dataset.
 * Returns null if the domain is not present — callers must not guess a
 * category for an absent domain.
 */
export function lookupTrackerCategory(domain: string): Category | null {
  const rawCategory = DOMAIN_CATEGORY[domain];
  if (!rawCategory) return null;
  return RAW_CATEGORY_TO_CATEGORY[rawCategory] ?? 'Other';
}
