import type { DestinationSummary } from '../lib/aggregate';
import { CategoryBadge } from './CategoryBadge';

export function DestinationList({
  destinations,
  blockedDomains,
  onSelect,
}: {
  destinations: DestinationSummary[];
  blockedDomains: string[];
  onSelect: (domain: string) => void;
}) {
  if (destinations.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-glyph" aria-hidden="true">
          ◇
        </span>
        <p className="empty-state-title">No third-party requests yet</p>
        <p className="empty-state-body">
          Browse this site normally and reopen Data Lens — requests are recorded as they happen.
        </p>
      </div>
    );
  }

  return (
    <ul className="destination-list">
      {destinations.map((destination) => {
        const isBlocked = blockedDomains.includes(destination.domain);
        return (
          <li key={destination.domain}>
            <button
              className={isBlocked ? 'destination-row destination-row--blocked' : 'destination-row'}
              onClick={() => onSelect(destination.domain)}
            >
              <span className="destination-domain">{destination.domain}</span>
              <span className="destination-meta">
                {isBlocked && (
                  <span
                    className="blocked-indicator"
                    title="Data Lens is blocking requests to this destination"
                  >
                    Blocked
                  </span>
                )}
                <CategoryBadge category={destination.category} />
                {destination.hasRiskSignal && (
                  <span className="signal-indicator" title="Risk signals observed for this destination">
                    signals
                  </span>
                )}
                <span className="destination-count">
                  {destination.requestCount} request{destination.requestCount === 1 ? '' : 's'}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
