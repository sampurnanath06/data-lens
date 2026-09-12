import type { Category } from '../../types';

// Deliberately muted, non-alarmist colors — CLAUDE.md section 3: third-party
// does not mean bad, and CDN in particular must read as calm/neutral, not
// as a threat indicator alongside Advertising.
const CATEGORY_CLASS: Record<Category, string> = {
  Analytics: 'cat-analytics',
  Advertising: 'cat-advertising',
  Social: 'cat-social',
  CDN: 'cat-cdn',
  Other: 'cat-other',
  Unknown: 'cat-unknown',
};

export function CategoryBadge({ category }: { category: Category }) {
  return <span className={`category-badge ${CATEGORY_CLASS[category]}`}>{category}</span>;
}
