// Data contract — FROZEN after Phase 0 (see CLAUDE.md section 5).
// Do not change these types without an explicit instruction.

export type Category =
  | 'Analytics'
  | 'Advertising'
  | 'Social'
  | 'CDN'
  | 'Other'
  | 'Unknown';

export type RiskSignalKind =
  | 'known_tracker'
  | 'tracking_parameter'
  | 'cross_site_presence';

export interface RiskSignal {
  kind: RiskSignalKind;
  /** Short factual detail, e.g. "gclid" or "seen on 3 sites". No interpretation. */
  detail?: string;
}

export interface NetworkEvent {
  id: string;
  sourceSite: string; // registrable domain of the page
  destinationDomain: string; // registrable domain of the request target
  requestType: string; // script | image | xmlhttprequest | ...
  timestamp: number; // epoch ms
  isThirdParty: boolean;
  category: Category;
  knownTracker: boolean;
  riskSignals: RiskSignal[];
  blocked: boolean;
}

export interface Explanation {
  explanation: string;
  whyItMatters: string;
  suggestedAction: string;
  source: 'on-device-ai' | 'fallback';
}
