import { getRegistrableDomain } from '../../utils/domain';

/**
 * Resolves the registrable domain of the active tab in the current window.
 * Requires no extra manifest permission beyond host_permissions: ["<all_urls>"]
 * (already declared) — that alone makes tab.url visible to chrome.tabs.query.
 * Returns null for anything we can't resolve a site for (no active tab,
 * a chrome:// / extension page, a tab with no URL yet, etc.) — the caller
 * must show an honest empty state rather than guessing.
 */
export async function getCurrentSiteDomain(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) return null;

    // chrome://, chrome-extension://, about:, file:// etc. aren't "sites" in
    // any sense this product observes third-party requests for — treat them
    // the same as no site detected rather than showing a stray hostname
    // fragment (e.g. tldts would read "extensions" out of
    // "chrome://extensions/").
    let protocol: string;
    try {
      protocol = new URL(tab.url).protocol;
    } catch {
      return null;
    }
    if (protocol !== 'http:' && protocol !== 'https:') return null;

    return getRegistrableDomain(tab.url);
  } catch (error) {
    console.error('[popup] Failed to resolve the current tab', error);
    return null;
  }
}
