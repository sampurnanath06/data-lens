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
        No third-party requests observed for this site yet.
      </div>
    );
  }

  return (
    <ul className="destination-list">
      {destinations.map((destination) => (
        <li key={destination.domain}>
          <button className="destination-row" onClick={() => onSelect(destination.domain)}>
            <span className="destination-domain">{destination.domain}</span>
            <span className="destination-meta">
              {blockedDomains.includes(destination.domain) && (
                <span className="blocked-indicator" title="Data Lens is blocking requests to this destination">
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
      ))}
    </ul>
  );
}
