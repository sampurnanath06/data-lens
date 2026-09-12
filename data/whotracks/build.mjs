// Regenerates data/whotracks/trackers.json from the WhoTracks.me / Ghostery
// TrackerDB source dataset. Not run at build time or by the extension itself
// — this is a one-off/occasional data-acquisition script for a maintainer to
// re-run when the upstream dataset updates. Run with:
//
//   node data/whotracks/build.mjs
//
// See data/whotracks/README.md for the license and what gets trimmed and why.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'tldts';

const SOURCE_URL =
  'https://raw.githubusercontent.com/whotracksme/whotracks.me/master/whotracksme/data/assets/trackerdb.sql';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(HERE, 'trackers.json');

// Only the categories the dataset actually defines (as of the source
// snapshot referenced in README.md). If the upstream dataset adds new
// category names in a future release, they will surface as "unmapped
// category" warnings below rather than being silently dropped or guessed.
const KNOWN_RAW_CATEGORIES = new Set([
  'advertising',
  'audio_video_player',
  'consent',
  'customer_interaction',
  'extensions',
  'hosting',
  'misc',
  'pornvertising',
  'site_analytics',
  'social_media',
  'utilities',
]);

function getRegistrableDomain(hostname) {
  const parsed = parse(hostname);
  if (parsed.isIp) return parsed.hostname;
  if (parsed.domain) return parsed.domain;
  return parsed.hostname ?? null;
}

/**
 * Minimal parser for the `INSERT INTO table VALUES(...);` statements in the
 * trackerdb.sql dump. Scans character-by-character respecting single-quoted
 * strings (with '' as an escaped quote) so that commas/parens inside quoted
 * text don't get mistaken for field separators — a regex with naive
 * greedy/non-greedy parens can't reliably tell those apart.
 */
function parseInserts(sql, tableName) {
  const marker = `INSERT INTO ${tableName} VALUES(`;
  const rows = [];
  let searchFrom = 0;

  for (;;) {
    const start = sql.indexOf(marker, searchFrom);
    if (start === -1) break;

    let i = start + marker.length;
    const fields = [];
    let cur = '';
    let inString = false;

    for (; i < sql.length; i++) {
      const c = sql[i];
      if (inString) {
        if (c === "'" && sql[i + 1] === "'") {
          cur += "'";
          i++;
          continue;
        }
        if (c === "'") {
          inString = false;
          continue;
        }
        cur += c;
      } else {
        if (c === "'") {
          inString = true;
          continue;
        }
        if (c === ',') {
          fields.push(cur);
          cur = '';
          continue;
        }
        if (c === ')') {
          fields.push(cur);
          i++;
          break;
        }
        cur += c;
      }
    }

    rows.push(fields.map((f) => (f === 'NULL' ? null : f)));
    searchFrom = i;
  }

  return rows;
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch trackerdb.sql: HTTP ${response.status}`);
  }
  const sql = await response.text();

  const categories = new Map(); // category id -> raw category name
  for (const [id, name] of parseInserts(sql, 'categories')) {
    categories.set(id, name);
  }

  const trackerCategory = new Map(); // tracker id -> raw category name
  for (const [id, , categoryId] of parseInserts(sql, 'trackers')) {
    trackerCategory.set(id, categoryId ? (categories.get(categoryId) ?? null) : null);
  }

  const domainRows = parseInserts(sql, 'tracker_domains'); // [tracker, domain, notes]

  // Our data contract only carries a registrable domain (eTLD+1), never a
  // full hostname (see CLAUDE.md section 5), so entries are collapsed onto
  // their registrable domain. Where multiple dataset entries collapse onto
  // the same registrable domain with different categories (e.g. a specific
  // subdomain carved out separately from the bare domain), the entry whose
  // dataset domain string already *is* the bare registrable domain wins —
  // it's the dataset's own designation for the domain as a whole, which is
  // the most faithful choice available once subdomain granularity is lost.
  const resolved = new Map(); // registrable domain -> { category, exact }
  let collisions = 0;
  let unmappedCategoryWarnings = 0;

  for (const [trackerId, domain] of domainRows) {
    const rawCategory = trackerCategory.get(trackerId);
    if (!rawCategory) continue;
    if (!KNOWN_RAW_CATEGORIES.has(rawCategory) && unmappedCategoryWarnings < 20) {
      console.warn(`Unmapped upstream category "${rawCategory}" for tracker "${trackerId}"`);
      unmappedCategoryWarnings++;
    }

    const registrable = getRegistrableDomain(domain);
    if (!registrable) continue;

    const isExact = registrable === domain;
    const existing = resolved.get(registrable);
    if (!existing) {
      resolved.set(registrable, { category: rawCategory, exact: isExact });
    } else if (isExact && !existing.exact) {
      collisions++;
      resolved.set(registrable, { category: rawCategory, exact: isExact });
    } else if (!isExact && existing.exact) {
      collisions++;
    } else if (existing.category !== rawCategory) {
      collisions++;
    }
  }

  const output = {};
  for (const [domain, { category }] of resolved) {
    output[domain] = category;
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));

  console.log(`Wrote ${resolved.size} domain -> category entries to ${OUTPUT_PATH}`);
  console.log(`Resolved ${collisions} domain-collapse collisions (see comment above).`);
  console.log(`Output size: ${fs.statSync(OUTPUT_PATH).size} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
