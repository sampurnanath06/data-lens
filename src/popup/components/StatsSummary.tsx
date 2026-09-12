import type { Category } from '../../types';
import { CategoryBadge } from './CategoryBadge';

const CATEGORY_ORDER: Category[] = ['Advertising', 'Analytics', 'Social', 'CDN', 'Other', 'Unknown'];

export function StatsSummary({
  total,
  categoryCounts,
}: {
  total: number;
  categoryCounts: Record<Category, number>;
}) {
  return (
    <div className="stats-summary">
      <div className="stats-total">
        <span className="stats-total-number">{total}</span>
        <span className="stats-total-label">third-party request{total === 1 ? '' : 's'} observed</span>
      </div>
      <div className="stats-categories">
        {CATEGORY_ORDER.filter((category) => categoryCounts[category] > 0).map((category) => (
          <div key={category} className="stats-category-chip">
            <CategoryBadge category={category} />
            <span className="stats-category-count">{categoryCounts[category]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
