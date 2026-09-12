import type { Category, RiskSignalKind } from '../types';

/**
 * The only data that ever reaches the model — CLAUDE.md section 10: only
 * structured observations the extension already made, never browsing
 * history, page content, or full URLs. riskSignals is bare kind strings
 * (no `detail`) matching the section 10 example exactly, keeping the
 * payload minimal even though the app has richer detail available locally
 * for the deterministic fallback (see fallback.ts).
 */
export interface AIObservationInput {
  domain: string;
  category: Category;
  knownTracker: boolean;
  riskSignals: RiskSignalKind[];
  sourceSitesObserved: string[];
}

// Verbatim in intent from CLAUDE.md section 10. The trailing paragraph is
// the structural instruction needed to pair with responseConstraint — not
// part of the "intent" text, just telling the model which JSON shape to fill.
export const SYSTEM_PROMPT = `You are a privacy explanation assistant. You are given only observations made by a browser extension. Explain what these observations mean in simple, accurate language. Do not claim knowledge of server-side behavior that was not observed. Do not claim that a company sells, stores, profiles, shares, or monetizes user data unless that is explicitly present in the supplied evidence. Do not call a request malicious merely because it is third-party. Distinguish what was observed from what it may indicate. Give a concise plain-English explanation, why it may matter, and one practical suggested action.

Respond with a JSON object with exactly three string fields: "explanation", "whyItMatters", and "suggestedAction".`;

export const EXPLANATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string' },
    whyItMatters: { type: 'string' },
    suggestedAction: { type: 'string' },
  },
  required: ['explanation', 'whyItMatters', 'suggestedAction'],
  additionalProperties: false,
} as const;

// Must match between availability() and create() per the current docs
// ("always pass the same options"). All our prompts/output are English.
export const LANGUAGE_MODEL_OPTIONS: LanguageModelOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export function buildUserPrompt(observation: AIObservationInput): string {
  return `Observations:\n${JSON.stringify(observation)}`;
}
