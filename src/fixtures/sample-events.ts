import type { NetworkEvent } from '../types';

// Realistic sample data used to build/test the dashboard without live
// capture, and as a fallback if live capture misbehaves during a demo.
//
// Covers: every Category, a known-tracker domain and an Unknown domain,
// and a destination (doubleclick.net) observed across 3 distinct source
// sites to exercise the cross_site_presence signal.

const now = Date.now();
const minutesAgo = (n: number) => now - n * 60 * 1000;

export const sampleNetworkEvents: NetworkEvent[] = [
  {
    id: 'fixture-1',
    sourceSite: 'thedailybyte.local',
    destinationDomain: 'google-analytics.com',
    requestType: 'script',
    timestamp: minutesAgo(35),
    isThirdParty: true,
    category: 'Analytics',
    knownTracker: true,
    riskSignals: [{ kind: 'known_tracker' }],
    blocked: false,
  },
  {
    id: 'fixture-2',
    sourceSite: 'thedailybyte.local',
    destinationDomain: 'doubleclick.net',
    requestType: 'image',
    timestamp: minutesAgo(30),
    isThirdParty: true,
    category: 'Advertising',
    knownTracker: true,
    riskSignals: [
      { kind: 'known_tracker' },
      { kind: 'tracking_parameter', detail: 'gclid' },
    ],
    blocked: false,
  },
  {
    id: 'fixture-3',
    sourceSite: 'thedailybyte.local',
    destinationDomain: 'connect.facebook.net',
    requestType: 'script',
    timestamp: minutesAgo(25),
    isThirdParty: true,
    category: 'Social',
    knownTracker: true,
    riskSignals: [
      { kind: 'known_tracker' },
      { kind: 'tracking_parameter', detail: 'fbclid' },
    ],
    blocked: false,
  },
  {
    id: 'fixture-4',
    sourceSite: 'thedailybyte.local',
    destinationDomain: 'cdn.jsdelivr.net',
    requestType: 'script',
    timestamp: minutesAgo(20),
    isThirdParty: true,
    category: 'CDN',
    knownTracker: false,
    riskSignals: [],
    blocked: false,
  },
  {
    id: 'fixture-5',
    sourceSite: 'thedailybyte.local',
    destinationDomain: 'js.stripe.com',
    requestType: 'script',
    timestamp: minutesAgo(15),
    isThirdParty: true,
    category: 'Other',
    knownTracker: false,
    riskSignals: [],
    blocked: false,
  },
  {
    id: 'fixture-6',
    sourceSite: 'thedailybyte.local',
    destinationDomain: 'xyzanalytics123.io',
    requestType: 'xmlhttprequest',
    timestamp: minutesAgo(10),
    isThirdParty: true,
    category: 'Unknown',
    knownTracker: false,
    riskSignals: [],
    blocked: false,
  },
  {
    id: 'fixture-7',
    sourceSite: 'example.com',
    destinationDomain: 'doubleclick.net',
    requestType: 'image',
    timestamp: minutesAgo(8),
    isThirdParty: true,
    category: 'Advertising',
    knownTracker: true,
    riskSignals: [
      { kind: 'known_tracker' },
      { kind: 'cross_site_presence', detail: 'seen on 2 sites' },
    ],
    blocked: false,
  },
  {
    id: 'fixture-8',
    sourceSite: 'another-news.local',
    destinationDomain: 'doubleclick.net',
    requestType: 'image',
    timestamp: minutesAgo(5),
    isThirdParty: true,
    category: 'Advertising',
    knownTracker: true,
    riskSignals: [
      { kind: 'known_tracker' },
      { kind: 'cross_site_presence', detail: 'seen on 3 sites' },
    ],
    blocked: false,
  },
];
