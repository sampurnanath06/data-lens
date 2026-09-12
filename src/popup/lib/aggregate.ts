import type { Category, NetworkEvent, RiskSignal } from '../../types';

// UI-local aggregation types. Not part of the frozen data contract
// (CLAUDE.md section 5) — these are derived views over NetworkEvent[],
// computed fresh from storage on every load, never persisted themselves.

export interface DestinationSummary {
  domain: string;
  category: Category;
  knownTracker: boolean;
  requestCount: number;
  hasRiskSignal: boolean;
  lastSeen: number;
}

export function aggregateDestinations(events: NetworkEvent[]): DestinationSummary[] {
  const byDomain = new Map<string, DestinationSummary>();

  for (const event of events) {
    const existing = byDomain.get(event.destinationDomain);
    if (!existing) {
      byDomain.set(event.destinationDomain, {
        domain: event.destinationDomain,
        category: event.category,
        knownTracker: event.knownTracker,
        requestCount: 1,
        hasRiskSignal: event.riskSignals.length > 0,
        lastSeen: event.timestamp,
      });
      continue;
    }
    existing.requestCount += 1;
    existing.hasRiskSignal = existing.hasRiskSignal || event.riskSignals.length > 0;
    existing.lastSeen = Math.max(existing.lastSeen, event.timestamp);
  }

  return [...byDomain.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

export function countByCategory(events: NetworkEvent[]): Record<Category, number> {
  const counts: Record<Category, number> = {
    Analytics: 0,
    Advertising: 0,
    Social: 0,
    CDN: 0,
    Other: 0,
    Unknown: 0,
  };
  for (const event of events) {
    counts[event.category] += 1;
  }
  return counts;
}

/** Deduplicated risk signals (by kind + detail) across every event for one destination. */
export function collectRiskSignals(events: NetworkEvent[], domain: string): RiskSignal[] {
  const seen = new Map<string, RiskSignal>();
  for (const event of events) {
    if (event.destinationDomain !== domain) continue;
    for (const signal of event.riskSignals) {
      seen.set(`${signal.kind}|${signal.detail ?? ''}`, signal);
    }
  }
  return [...seen.values()];
}
