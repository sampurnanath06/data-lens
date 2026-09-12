import { useState } from 'react';
import type { DestinationSummary } from '../lib/aggregate';
import { describeRiskSignal } from '../lib/riskSignalCopy';
import { CategoryBadge } from './CategoryBadge';
import type { Explanation, RiskSignal } from '../../types';
import { explainDestination, type AIStatus } from '../../ai/explainer';
import { blockDestination, unblockDestination } from '../../blocking/blocker';

type ExplainState = { kind: 'idle' } | { kind: AIStatus } | { kind: 'done'; explanation: Explanation };

const STATUS_COPY: Record<AIStatus, string> = {
  checking: 'Checking on-device AI availability…',
  downloading: 'On-device AI is preparing…',
  generating: 'Generating explanation…',
};

const SOURCE_LABEL: Record<Explanation['source'], string> = {
  'on-device-ai': 'On-device AI',
  fallback: 'Built-in explanation',
};

export function DetailView({
  destination,
  riskSignals,
  crossSiteSites,
  isBlocked,
  onBlockChange,
  onBack,
}: {
  destination: DestinationSummary;
  riskSignals: RiskSignal[];
  crossSiteSites: string[];
  isBlocked: boolean;
  onBlockChange: () => void;
  onBack: () => void;
}) {
  const [explainState, setExplainState] = useState<ExplainState>({ kind: 'idle' });
  const isBusy = explainState.kind !== 'idle' && explainState.kind !== 'done';

  const [blockWorking, setBlockWorking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const handleExplain = async () => {
    setExplainState({ kind: 'checking' });
    const explanation = await explainDestination(
      {
        domain: destination.domain,
        category: destination.category,
        knownTracker: destination.knownTracker,
        riskSignals,
        sourceSitesObserved: crossSiteSites,
      },
      (status) => setExplainState({ kind: status }),
    );
    setExplainState({ kind: 'done', explanation });
  };

  const handleToggleBlock = async () => {
    setBlockWorking(true);
    setBlockError(null);
    const wasBlocked = isBlocked;
    // CLAUDE.md section 12: never report success unless Chrome actually
    // accepted the rule — blockDestination/unblockDestination only resolve
    // { success: true } after re-reading the active rules to confirm it.
    const result = wasBlocked
      ? await unblockDestination(destination.domain)
      : await blockDestination(destination.domain);
    setBlockWorking(false);

    if (result.success) {
      onBlockChange();
      return;
    }

    const reason = result.reason ?? 'An unknown error occurred.';
    setBlockError(
      wasBlocked
        ? `Data Lens could not confirm this destination was unblocked (${reason}). It may still be blocked.`
        : `This destination has been marked suspicious, but Data Lens could not create a blocking rule for it (${reason}).`,
    );
  };

  return (
    <div className="detail-view">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      <div className="detail-header">
        <h1 className="detail-domain">{destination.domain}</h1>
        <CategoryBadge category={destination.category} />
        {isBlocked && <span className="blocked-indicator">Blocked</span>}
      </div>

      {/* OBSERVED FACTS — what the extension actually recorded. This is the
          only section allowed to state things as fact. Nothing here is ever
          inferred. */}
      <section className="fact-panel" aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="panel-eyebrow panel-eyebrow--fact">
          Observed facts
        </h2>

        <dl className="fact-list">
          <div className="fact-row">
            <dt>Known tracker</dt>
            <dd>
              {destination.knownTracker
                ? 'Yes — listed in the tracker dataset.'
                : 'No — not found in the tracker dataset.'}
            </dd>
          </div>
          <div className="fact-row">
            <dt>Requests this session</dt>
            <dd>{destination.requestCount}</dd>
          </div>
          <div className="fact-row">
            <dt>Cross-site presence</dt>
            <dd>
              {crossSiteSites.length >= 2
                ? `Contacted from ${crossSiteSites.length} sites this session: ${crossSiteSites.join(', ')}.`
                : crossSiteSites.length === 1
                  ? 'Contacted from 1 site this session so far.'
                  : 'No cross-site contact recorded yet this session.'}
            </dd>
          </div>
          <div className="fact-row">
            <dt>Blocked</dt>
            <dd>
              {isBlocked
                ? 'Yes — Data Lens is blocking requests to this destination.'
                : 'No — requests to this destination are not being blocked.'}
            </dd>
          </div>
        </dl>

        <div className="fact-signals">
          <h3 className="fact-signals-heading">Risk signals</h3>
          {riskSignals.length === 0 ? (
            <p className="fact-signals-empty">No specific risk signals observed for this destination.</p>
          ) : (
            <ul className="fact-signals-list">
              {riskSignals.map((signal, index) => (
                <li key={`${signal.kind}-${signal.detail ?? index}`}>{describeRiskSignal(signal)}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* INTERPRETATION — anything generated (on-device AI or the
          deterministic fallback) lands here, visually distinct from facts
          above. The source is always labeled honestly once a result exists. */}
      <section className="interpretation-panel" aria-labelledby="interpretation-heading">
        <h2 id="interpretation-heading" className="panel-eyebrow panel-eyebrow--interpretation">
          Interpretation
        </h2>

        <div className="explanation-area">
          <button className="explain-button" onClick={handleExplain} disabled={isBusy}>
            {explainState.kind === 'done' ? 'Re-explain this destination' : 'Explain with on-device AI'}
          </button>

          {explainState.kind === 'idle' && (
            <div className="explanation-result explanation-result--empty">No explanation generated yet.</div>
          )}

          {isBusy && (
            <div className="explanation-result explanation-result--pending">
              {STATUS_COPY[explainState.kind]}
            </div>
          )}

          {explainState.kind === 'done' && (
            <div className="explanation-result explanation-result--filled">
              <span className={`source-badge source-badge--${explainState.explanation.source}`}>
                {SOURCE_LABEL[explainState.explanation.source]}
              </span>
              <p className="explanation-text">{explainState.explanation.explanation}</p>
              <p className="explanation-why">
                <strong>Why it may matter: </strong>
                {explainState.explanation.whyItMatters}
              </p>
            </div>
          )}
        </div>

        <div className="suggested-action">
          <h3 className="suggested-action-heading">Suggested action</h3>
          {explainState.kind === 'done' ? (
            <p className="suggested-action-text">{explainState.explanation.suggestedAction}</p>
          ) : (
            <p className="suggested-action-empty">
              A suggested action will appear here once an explanation is generated.
            </p>
          )}
        </div>
      </section>

      <section className="actions-panel">
        <button
          className={isBlocked ? 'block-button block-button--unblock' : 'block-button block-button--block'}
          onClick={handleToggleBlock}
          disabled={blockWorking}
        >
          {blockWorking
            ? isBlocked
              ? 'Unblocking…'
              : 'Blocking…'
            : isBlocked
              ? 'Unblock this destination'
              : 'Block this destination'}
        </button>

        {blockError && <p className="block-error">{blockError}</p>}
      </section>
    </div>
  );
}
