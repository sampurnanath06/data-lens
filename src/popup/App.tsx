import { useCallback, useEffect, useState } from 'react';
import type { NetworkEvent } from '../types';
import {
  clearAll,
  getBlockedDestinations,
  getCrossSiteMap,
  getEventsForSite,
  seedFixtures,
} from '../storage/storage';
import { getCurrentSiteDomain } from './lib/site';
import { aggregateDestinations, collectRiskSignals, countByCategory } from './lib/aggregate';
import { MainView } from './components/MainView';
import { DetailView } from './components/DetailView';
import { DevTools } from './components/DevTools';
import './styles/dashboard.css';

// Matches the sourceSite used throughout src/fixtures/sample-events.ts and
// CLAUDE.md's own example AI input (section 10) — the demo site's intended
// domain. It never resolves via real DNS, so "demo data" is the only way to
// ever see it as a "current site" in this popup; that's why it's a
// deliberate, visibly-labeled mode rather than something the live-site
// resolver could ever produce by accident.
const DEMO_SITE = 'thedailybyte.local';

type DataSource = 'live' | 'demo';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<DataSource>('live');
  const [site, setSite] = useState<string | null>(null);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [crossSiteMap, setCrossSiteMap] = useState<Record<string, string[]>>({});
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const loadForSite = useCallback(async (targetSite: string | null) => {
    setLoading(true);
    setSelectedDomain(null);
    try {
      const [siteEvents, map, blocked] = await Promise.all([
        targetSite ? getEventsForSite(targetSite) : Promise.resolve([]),
        getCrossSiteMap(),
        getBlockedDestinations(),
      ]);
      setEvents(siteEvents);
      setCrossSiteMap(map);
      setBlockedDomains(blocked);
    } finally {
      setLoading(false);
    }
  }, []);

  // Blocked state can change without the rest of the data changing (the
  // user just blocked/unblocked something in the detail view) — a cheap
  // standalone refresh avoids re-fetching events/crossSiteMap for that.
  const refreshBlockedDomains = useCallback(async () => {
    setBlockedDomains(await getBlockedDestinations());
  }, []);

  const loadLiveSite = useCallback(async () => {
    const resolved = await getCurrentSiteDomain();
    setSite(resolved);
    await loadForSite(resolved);
  }, [loadForSite]);

  useEffect(() => {
    // Only on mount — the popup is a fresh instance every time it opens, so
    // there's no "tab changed under us" case to react to.
    void loadLiveSite();
  }, [loadLiveSite]);

  const handleUseLiveSite = () => {
    setDataSource('live');
    loadLiveSite();
  };

  const handleLoadSampleData = async () => {
    setLoading(true);
    await seedFixtures();
    setDataSource('demo');
    setSite(DEMO_SITE);
    await loadForSite(DEMO_SITE);
  };

  const handleClearData = async () => {
    setLoading(true);
    await clearAll();
    await loadForSite(dataSource === 'demo' ? DEMO_SITE : site);
  };

  const destinations = aggregateDestinations(events);
  const categoryCounts = countByCategory(events);
  const selectedDestination = destinations.find((d) => d.domain === selectedDomain) ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Data Lens</span>
        <span className="app-subtitle">Third-party request observer</span>
      </header>

      <main className="app-body">
        {loading ? (
          <div className="loading-state">
            <span className="loading-pulse" aria-hidden="true" />
            Loading…
          </div>
        ) : selectedDestination ? (
          <DetailView
            destination={selectedDestination}
            riskSignals={collectRiskSignals(events, selectedDestination.domain)}
            crossSiteSites={crossSiteMap[selectedDestination.domain] ?? []}
            isBlocked={blockedDomains.includes(selectedDestination.domain)}
            onBlockChange={refreshBlockedDomains}
            onBack={() => setSelectedDomain(null)}
          />
        ) : site ? (
          <MainView
            siteLabel={site}
            isDemoData={dataSource === 'demo'}
            total={events.length}
            categoryCounts={categoryCounts}
            destinations={destinations}
            blockedDomains={blockedDomains}
            onSelectDestination={setSelectedDomain}
          />
        ) : (
          <div className="empty-state">
            <span className="empty-state-glyph" aria-hidden="true">
              ◇
            </span>
            <p className="empty-state-title">No site detected for this tab</p>
            <p className="empty-state-body">
              Open a website in this window and reopen Data Lens, or load sample data below to explore
              the dashboard without one.
            </p>
          </div>
        )}
      </main>

      <DevTools
        dataSource={dataSource}
        onUseLiveSite={handleUseLiveSite}
        onLoadSampleData={handleLoadSampleData}
        onClearData={handleClearData}
      />
    </div>
  );
}
