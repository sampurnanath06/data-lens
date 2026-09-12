import type { Category, Explanation, RiskSignal } from '../types';
import { buildFallbackExplanation } from './fallback';
import {
  buildUserPrompt,
  EXPLANATION_RESPONSE_SCHEMA,
  LANGUAGE_MODEL_OPTIONS,
  SYSTEM_PROMPT,
  type AIObservationInput,
} from './prompt';

export interface ExplainInput {
  domain: string;
  category: Category;
  knownTracker: boolean;
  riskSignals: RiskSignal[];
  sourceSitesObserved: string[];
}

export type AIStatus = 'checking' | 'downloading' | 'generating';

/**
 * The single owner of: availability checking, session creation/reuse,
 * prompting, defensive output parsing, and fallback selection. Callers get
 * one function and an Explanation back — they never know or care which
 * path produced it (CLAUDE.md section 10).
 *
 * `onStatus` is optional UI feedback for the wait — in particular,
 * 'downloading' is when the caller should show "On-device AI is
 * preparing…" (section 10). This function never throws and never returns
 * anything other than a valid Explanation; on any failure it silently
 * (but honestly, via `source: 'fallback'`) falls back.
 */
export async function explainDestination(
  input: ExplainInput,
  onStatus?: (status: AIStatus) => void,
): Promise<Explanation> {
  const toFallback = () =>
    buildFallbackExplanation({
      domain: input.domain,
      category: input.category,
      knownTracker: input.knownTracker,
      riskSignals: input.riskSignals,
      sourceSitesObserved: input.sourceSitesObserved,
    });

  // No global at all — old Chrome, flag off, or a non-Chrome browser.
  // Never throw a ReferenceError trying to reference it directly.
  if (typeof LanguageModel === 'undefined') {
    return toFallback();
  }

  try {
    onStatus?.('checking');
    const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);

    if (availability === 'unavailable') {
      return toFallback();
    }
    if (availability !== 'available') {
      // 'downloadable' or 'downloading' — model isn't ready yet.
      onStatus?.('downloading');
    }

    const base = await getBaseSession(onStatus);
    const session = await base.clone();

    onStatus?.('generating');
    const observation: AIObservationInput = {
      domain: input.domain,
      category: input.category,
      knownTracker: input.knownTracker,
      riskSignals: [...new Set(input.riskSignals.map((s) => s.kind))],
      sourceSitesObserved: input.sourceSitesObserved,
    };

    const raw = await session.prompt(buildUserPrompt(observation), {
      responseConstraint: EXPLANATION_RESPONSE_SCHEMA,
    });
    session.destroy();

    return parseModelOutput(raw) ?? toFallback();
  } catch (error) {
    // Availability check failed, download failed, prompt failed, session
    // creation failed — whatever it is, the model must never break the
    // dashboard. Fall back honestly instead.
    console.error('[explainer] On-device AI path failed, using fallback explanation', error);
    return toFallback();
  }
}

// The heavy session (holds the system prompt) is created once and reused —
// CLAUDE.md section 10: "do not create a new session per request". Each
// individual explain call clones it (cheap, reuses the loaded model) so
// different destinations' explanations never contaminate each other's
// conversation context.
let baseSessionPromise: Promise<LanguageModelSession> | null = null;

function getBaseSession(onStatus?: (status: AIStatus) => void): Promise<LanguageModelSession> {
  if (!baseSessionPromise) {
    baseSessionPromise = LanguageModel!.create({
      ...LANGUAGE_MODEL_OPTIONS,
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', () => onStatus?.('downloading'));
      },
    }).catch((error) => {
      // Don't cache a failed attempt — a later call (e.g. after the model
      // becomes available) should get to try again.
      baseSessionPromise = null;
      throw error;
    });
  }
  return baseSessionPromise;
}

function parseModelOutput(raw: string): Explanation | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const { explanation, whyItMatters, suggestedAction } = parsed;
    if (!isNonEmptyString(explanation) || !isNonEmptyString(whyItMatters) || !isNonEmptyString(suggestedAction)) {
      return null;
    }

    return {
      explanation: explanation.trim(),
      whyItMatters: whyItMatters.trim(),
      suggestedAction: suggestedAction.trim(),
      source: 'on-device-ai',
    };
  } catch (error) {
    console.error('[explainer] Malformed model output, using fallback explanation', error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
