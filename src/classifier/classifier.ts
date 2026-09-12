import type { Category } from '../types';
import { isTrackerDatasetReady, lookupTrackerCategory } from './tracker-data';

export interface ClassificationResult {
  category: Category;
  knownTracker: boolean;
}

let warnedNotReady = false;

/**
 * Deterministic dataset lookup only — no AI, no heuristics, no guessing.
 * A domain absent from the dataset is 'Unknown' / not a known tracker,
 * full stop (CLAUDE.md section 8).
 *
 * The dataset is a static bundled import (see tracker-data.ts), so under
 * normal operation it is always ready before classify() can even be
 * called. This check exists so that if that ever regresses — e.g. someone
 * changes the dataset to load asynchronously without also making classify()
 * await it — the failure is a loud, obvious warning instead of every
 * domain silently and permanently classifying as Unknown.
 */
export function classify(domain: string): ClassificationResult {
  if (!isTrackerDatasetReady() && !warnedNotReady) {
    warnedNotReady = true;
    console.warn(
      `[classifier] classify() called before the tracker dataset was ready. ` +
        `Returning Unknown for "${domain}" (and every domain until this is fixed) ` +
        `is not a real classification result.`,
    );
  }

  const category = lookupTrackerCategory(domain);
  if (!category) {
    return { category: 'Unknown', knownTracker: false };
  }
  return { category, knownTracker: true };
}
