import type { NetworkEvent } from '../types';
import { sampleNetworkEvents } from '../fixtures/sample-events';

// The only module in the project allowed to touch chrome.storage directly.
// Every function here must handle failure gracefully and never throw into
// the UI or background code that calls it.

const STORAGE_KEYS = {
  NETWORK_EVENTS: 'networkEvents',
  CROSS_SITE_MAP: 'crossSiteMap',
  BLOCKED_DESTINATIONS: 'blockedDestinations',
} as const;

async function readKey<T>(key: string, fallback: T): Promise<T> {
  try {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? fallback;
  } catch (error) {
    console.error(`[storage] Failed to read "${key}"`, error);
    return fallback;
  }
}

async function writeKey(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`[storage] Failed to write "${key}"`, error);
  }
}

export async function saveNetworkEvent(event: NetworkEvent): Promise<void> {
  const events = await readKey<NetworkEvent[]>(STORAGE_KEYS.NETWORK_EVENTS, []);
  events.push(event);
  await writeKey(STORAGE_KEYS.NETWORK_EVENTS, events);
}

export async function getNetworkEvents(): Promise<NetworkEvent[]> {
  return readKey<NetworkEvent[]>(STORAGE_KEYS.NETWORK_EVENTS, []);
}

export async function getEventsForSite(site: string): Promise<NetworkEvent[]> {
  const events = await getNetworkEvents();
  return events.filter((event) => event.sourceSite === site);
}

export async function recordCrossSiteContact(
  destination: string,
  sourceSite: string,
): Promise<void> {
  const map = await readKey<Record<string, string[]>>(STORAGE_KEYS.CROSS_SITE_MAP, {});
  const sites = map[destination] ?? [];
  if (!sites.includes(sourceSite)) {
    sites.push(sourceSite);
  }
  map[destination] = sites;
  await writeKey(STORAGE_KEYS.CROSS_SITE_MAP, map);
}

export async function getCrossSiteMap(): Promise<Record<string, string[]>> {
  return readKey<Record<string, string[]>>(STORAGE_KEYS.CROSS_SITE_MAP, {});
}

export async function saveBlockedDestination(domain: string): Promise<void> {
  const blocked = await readKey<string[]>(STORAGE_KEYS.BLOCKED_DESTINATIONS, []);
  if (!blocked.includes(domain)) {
    blocked.push(domain);
    await writeKey(STORAGE_KEYS.BLOCKED_DESTINATIONS, blocked);
  }
}

export async function getBlockedDestinations(): Promise<string[]> {
  return readKey<string[]>(STORAGE_KEYS.BLOCKED_DESTINATIONS, []);
}

export async function removeBlockedDestination(domain: string): Promise<void> {
  const blocked = await readKey<string[]>(STORAGE_KEYS.BLOCKED_DESTINATIONS, []);
  const filtered = blocked.filter((existing) => existing !== domain);
  await writeKey(STORAGE_KEYS.BLOCKED_DESTINATIONS, filtered);
}

export async function clearAll(): Promise<void> {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('[storage] Failed to clear storage', error);
  }
}

export async function seedFixtures(): Promise<void> {
  try {
    await writeKey(STORAGE_KEYS.NETWORK_EVENTS, sampleNetworkEvents);

    const crossSiteMap: Record<string, string[]> = {};
    for (const event of sampleNetworkEvents) {
      const sites = crossSiteMap[event.destinationDomain] ?? [];
      if (!sites.includes(event.sourceSite)) {
        sites.push(event.sourceSite);
      }
      crossSiteMap[event.destinationDomain] = sites;
    }
    await writeKey(STORAGE_KEYS.CROSS_SITE_MAP, crossSiteMap);
  } catch (error) {
    console.error('[storage] Failed to seed fixtures', error);
  }
}
