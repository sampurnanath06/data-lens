import { parse } from 'tldts';

/**
 * Registrable-domain extraction (eTLD+1) using the public suffix list via
 * `tldts`. A naive split-on-dots approach breaks on domains like
 * `bbc.co.uk` (would yield `co.uk`) — this uses the real suffix list instead.
 *
 * `localhost` and bare IP addresses have no public suffix, so they fall back
 * to the raw hostname. This is intentional: it lets `http://localhost:PORT`
 * and `http://127.0.0.1:PORT` be treated as two distinct sites, which the
 * demo site relies on for cross-site presence testing.
 */
export function getRegistrableDomain(urlOrOrigin: string): string | null {
  try {
    const parsed = parse(urlOrOrigin);
    if (parsed.isIp) {
      return parsed.hostname;
    }
    if (parsed.domain) {
      return parsed.domain;
    }
    return parsed.hostname ?? null;
  } catch {
    return null;
  }
}
