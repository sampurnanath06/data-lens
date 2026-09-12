import type { Category } from '../../types';
import type { DestinationSummary } from '../lib/aggregate';
import { StatsSummary } from './StatsSummary';
import { DestinationList } from './DestinationList';

export function MainView({
  siteLabel,
  isDemoData,
  total,
  categoryCounts,
  destinations,
  onSelectDestination,
}: {
  siteLabel: string;
  isDemoData: boolean;
  total: number;
  categoryCounts: Record<Category, number>;
  destinations: DestinationSummary[];
  onSelectDestination: (domain: string) => void;
}) {
  return (
    <div className="main-view">
      <div className="site-banner">
        <span className="site-banner-label">{isDemoData ? 'Sample data for' : 'This site'}</span>
        <span className="site-banner-domain">{siteLabel}</span>
      </div>

      <StatsSummary total={total} categoryCounts={categoryCounts} />

      <h2 className="section-heading">Third-party destinations</h2>
      <DestinationList destinations={destinations} onSelect={onSelectDestination} />
    </div>
  );
}
