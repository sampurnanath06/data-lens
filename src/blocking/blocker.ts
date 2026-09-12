import { getRegistrableDomain } from '../utils/domain';
import { removeBlockedDestination, saveBlockedDestination } from '../storage/storage';

// declarativeNetRequest dynamic rules only (CLAUDE.md 6.4 / 12) — webRequest
// is never used for blocking, only for observation elsewhere in this app.
// Dynamic rules (not session rules) persist across browser restarts, which
// is what "block this destination" should mean to a user.

export interface BlockActionResult {
  success: boolean;
  /** Present when success is false — an honest, human-readable reason. */
  reason?: string;
}

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})+$/i;

/**
 * A rule id must be a stable function of the domain (not e.g. "next free
 * id") so that unblocking — given only the domain string, per the frozen
 * storage contract — can find the same rule again without any extra
 * persisted domain->id mapping.
 */
function domainToRuleId(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (Math.imul(hash, 31) + domain.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2147483000) + 1;
}

function urlFilterFor(domain: string): string {
  // '||domain^' — domain anchor + separator, matches the domain and every
  // subdomain, any path/port/query. Verified against the current
  // declarativeNetRequest matching-algorithm docs (not a trailing '/',
  // which the docs call less precise).
  return `||${domain}^`;
}

function isValidDomain(domain: string): boolean {
  if (!DOMAIN_PATTERN.test(domain)) return false;
  // Round-trip through the same registrable-domain logic the observer
  // uses — rejects anything that isn't already a clean registrable domain
  // (a path, a protocol, a stray subdomain-only fragment, etc.) before it
  // ever becomes part of a urlFilter string.
  return getRegistrableDomain(`https://${domain}/`) === domain;
}

function buildRule(domain: string): chrome.declarativeNetRequest.Rule {
  return {
    id: domainToRuleId(domain),
    priority: 1,
    action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
    condition: {
      urlFilter: urlFilterFor(domain),
      // resourceTypes intentionally omitted: per the docs, omitting it
      // blocks every resource type except main_frame — exactly right here,
      // since this blocks third-party *requests* to the destination, not
      // a user's own direct navigation to it.
    },
  };
}

/**
 * Creates a dynamic declarativeNetRequest rule blocking the domain, then
 * re-reads the active rules to confirm Chrome actually accepted it before
 * ever reporting success or persisting the blocked state. A resolved
 * updateDynamicRules() promise is necessary but not, on its own, treated
 * as sufficient (CLAUDE.md section 12).
 */
export async function blockDestination(rawDomain: string): Promise<BlockActionResult> {
  const domain = rawDomain.trim().toLowerCase();
  if (!isValidDomain(domain)) {
    return { success: false, reason: `"${rawDomain}" is not a valid domain.` };
  }

  try {
    const rule = buildRule(domain);
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const alreadyPresent = existing.some((r) => r.condition.urlFilter === rule.condition.urlFilter);

    if (!alreadyPresent) {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });

      const after = await chrome.declarativeNetRequest.getDynamicRules();
      const confirmed = after.some(
        (r) => r.id === rule.id && r.condition.urlFilter === rule.condition.urlFilter,
      );
      if (!confirmed) {
        return { success: false, reason: 'Chrome did not accept the blocking rule.' };
      }
    }

    await saveBlockedDestination(domain);
    return { success: true };
  } catch (error) {
    console.error('[blocker] Failed to block destination', domain, error);
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error while creating the blocking rule.',
    };
  }
}

/** Removes the dynamic rule and confirms removal before updating storage. */
export async function unblockDestination(rawDomain: string): Promise<BlockActionResult> {
  const domain = rawDomain.trim().toLowerCase();
  const ruleId = domainToRuleId(domain);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });

    const after = await chrome.declarativeNetRequest.getDynamicRules();
    const stillPresent = after.some((r) => r.id === ruleId);
    if (stillPresent) {
      return { success: false, reason: 'Chrome did not remove the blocking rule.' };
    }

    await removeBlockedDestination(domain);
    return { success: true };
  } catch (error) {
    console.error('[blocker] Failed to unblock destination', domain, error);
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error while removing the blocking rule.',
    };
  }
}
