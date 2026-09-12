import type { Category, Explanation, RiskSignal } from '../types';

export interface FallbackInput {
  domain: string;
  category: Category;
  knownTracker: boolean;
  /** Full signals with `detail`, unlike what's sent to the model — this is
   * local template rendering, not data leaving the device, so it can use
   * everything the dashboard already shows in the Observed Facts panel. */
  riskSignals: RiskSignal[];
  sourceSitesObserved: string[];
}

/**
 * Deterministic, no-AI explanations. CLAUDE.md section 11: these must be
 * good enough to carry the entire live demo alone, written with the same
 * care as shipped product copy, and held to the claim rule (section 3) —
 * never "malicious", never a claim about what a company does with data
 * beyond what was actually observed.
 */
export function buildFallbackExplanation(input: FallbackInput): Explanation {
  const { domain, category, knownTracker, riskSignals, sourceSitesObserved } = input;

  const trackingParams = [...new Set(
    riskSignals.filter((s) => s.kind === 'tracking_parameter' && s.detail).map((s) => s.detail as string),
  )];
  const hasCrossSite = riskSignals.some((s) => s.kind === 'cross_site_presence');
  const siteCount = sourceSitesObserved.length;

  const base = CATEGORY_TEMPLATES[category](domain, knownTracker);

  const whyItMattersParts = [base.whyItMatters];
  if (trackingParams.length === 1) {
    whyItMattersParts.push(
      `This request also included a "${trackingParams[0]}" tracking parameter, which is commonly used to attribute clicks from ads or shared links.`,
    );
  } else if (trackingParams.length > 1) {
    whyItMattersParts.push(
      `This request also included tracking parameters (${trackingParams.join(', ')}), commonly used to attribute clicks from ads or shared links.`,
    );
  }
  if (hasCrossSite) {
    const sitesList = sourceSitesObserved.length > 0 ? ` (${sourceSitesObserved.join(', ')})` : '';
    whyItMattersParts.push(
      `This destination was also observed on ${siteCount} different sites in this session${sitesList}, which is consistent with the same destination being present across multiple pages you visited.`,
    );
  }

  return {
    explanation: base.explanation,
    whyItMatters: whyItMattersParts.join(' '),
    suggestedAction: base.suggestedAction,
    source: 'fallback',
  };
}

interface CategoryCopy {
  explanation: string;
  whyItMatters: string;
  suggestedAction: string;
}

const CATEGORY_TEMPLATES: Record<Category, (domain: string, knownTracker: boolean) => CategoryCopy> = {
  Analytics: (domain, knownTracker) => ({
    explanation:
      `${domain} is categorized as an analytics destination${knownTracker ? ', and is listed in the tracker dataset used by this extension' : ''}. Requests like this are typically used to measure how a page is used — for example, page views, clicks, or time spent.`,
    whyItMatters:
      'Analytics requests on their own are a common, everyday part of how most websites measure traffic.',
    suggestedAction:
      "No action is necessary for the page to work normally. If you'd prefer this destination not receive requests from your browser, you can block it.",
  }),
  Advertising: (domain, knownTracker) => ({
    explanation:
      `${domain} is categorized as an advertising destination${knownTracker ? ', and is listed in the tracker dataset used by this extension' : ''}. Requests like this are typically used to serve or measure ads on the page you were viewing.`,
    whyItMatters:
      'Advertising destinations are often present on many different websites, which can make it possible for the same destination to be contacted from multiple sites you visit.',
    suggestedAction:
      "No action is necessary for the page to keep working normally without it. If you'd rather this destination not receive requests from your browser, blocking it is the most direct option.",
  }),
  Social: (domain, knownTracker) => ({
    explanation:
      `${domain} is categorized as a social destination${knownTracker ? ', and is listed in the tracker dataset used by this extension' : ''}. Requests like this are typically associated with social sharing buttons, embedded posts, or social login widgets.`,
    whyItMatters:
      "Social widgets are often embedded on many unrelated sites, which can let the same platform observe that your browser visited those sites even if you don't interact with the widget.",
    suggestedAction:
      "If the social features on this page aren't something you use, blocking this destination generally won't affect the rest of the page.",
  }),
  CDN: (domain, knownTracker) => ({
    explanation:
      `${domain} is categorized as a content delivery network (CDN)${knownTracker ? ', and is listed in the tracker dataset used by this extension' : ''}. Requests like this are typically used to load shared libraries, fonts, or static assets — infrastructure, not tracking, in most cases.`,
    whyItMatters:
      'CDNs are widely used across the web for ordinary technical reasons. Being a third-party destination does not by itself indicate tracking.',
    suggestedAction:
      'Blocking a CDN destination can sometimes break the appearance or functionality of a page, since scripts or styles are often loaded from it. Consider leaving it unless you have a specific reason to block it.',
  }),
  Other: (domain, knownTracker) => ({
    explanation:
      `${domain} is categorized as Other${knownTracker ? ' and is listed in the tracker dataset used by this extension' : ''} — it doesn't fall into the advertising, analytics, social, or CDN categories the tracker dataset defines. It may provide functionality like chat widgets, payments, or consent management.`,
    whyItMatters:
      'Destinations in this category serve a range of purposes, so what a specific request is for depends on the destination itself.',
    suggestedAction:
      "If you recognize this destination and it isn't something you use on this page, blocking it is a reasonable option to try.",
  }),
  Unknown: (domain) => ({
    explanation:
      `${domain} was not found in the tracker dataset this extension uses, so its category and purpose aren't classified.`,
    whyItMatters:
      "An unclassified destination isn't necessarily concerning — the dataset doesn't cover every domain on the web — but it also means this extension has no category-level context to offer about it.",
    suggestedAction:
      'If you don\'t recognize this destination, you can block it. If the page stops working correctly afterward, you can unblock it again.',
  }),
};
