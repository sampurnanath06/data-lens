import type { RiskSignal } from '../../types';

/**
 * Plain factual statements for each risk signal — CLAUDE.md section 3: these
 * describe what was observed, never what it implies and never that a
 * request is malicious or that a company sells/stores/profiles data.
 */
export function describeRiskSignal(signal: RiskSignal): string {
  switch (signal.kind) {
    case 'known_tracker':
      return 'This domain is listed as a known tracker in the tracker dataset.';
    case 'tracking_parameter':
      return `A "${signal.detail ?? 'unknown'}" tracking parameter was observed in this request's URL.`;
    case 'cross_site_presence':
      return `This destination was observed across multiple sites in this session (${signal.detail ?? 'multiple sites'}).`;
    default:
      return 'A risk signal was observed.';
  }
}
