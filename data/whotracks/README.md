# Tracker dataset

`trackers.json` in this directory is what Data Lens's classifier
(`src/classifier/`) loads at build time. It is a **trimmed, generated**
artifact — regenerate it with `node data/whotracks/build.mjs`, don't hand-edit it.

## Source

The data comes from the SQLite snapshot that the
[WhoTracks.me](https://github.com/whotracksme/whotracks.me) project bundles
as `whotracksme/data/assets/trackerdb.sql`. That file is itself generated
from a release of [Ghostery's TrackerDB](https://github.com/ghostery/trackerdb)
(the SQL dump's header records the exact release it was built from). We fetch
it directly from `whotracks.me`'s `master` branch on GitHub — see
`build.mjs` for the exact URL.

The snapshot has four tables: `categories`, `companies`, `trackers`, and
`tracker_domains`. We use `categories`, `trackers`, and `tracker_domains`
(id, name, category, domains). We do **not** use `companies` — see Trimming
below.

## License and attribution

The tracker/category/domain data itself (via TrackerDB) is licensed under
**Creative Commons Attribution-NonCommercial-ShareAlike 4.0
(CC-BY-NC-SA-4.0)** — https://creativecommons.org/licenses/by-nc-sa/4.0/,
Copyright Ghostery GmbH.

**This is a non-commercial license.** That's compatible with this project's
current status as a hackathon/demo build, but it means the tracker dataset
specifically — not the rest of this repo — could not be redistributed as
part of a commercial product without a different data source or a license
from Ghostery.

(Note: WhoTracks.me's own repository content, e.g. its published traffic
statistics, is separately licensed CC-BY-4.0 with MIT-licensed code — that
license applies to the statistics site, not to the TrackerDB metadata
bundled inside it, which carries its own CC-BY-NC-SA-4.0 terms as noted
above.)

**Attribution:** Tracker classification data from
[Ghostery TrackerDB](https://github.com/ghostery/trackerdb), distributed via
[WhoTracks.me](https://github.com/whotracksme/whotracks.me), licensed
CC-BY-NC-SA-4.0.

## What we trimmed, and why

We kept **every** domain → category mapping the dataset provides (4,754
registrable domains after collapsing to eTLD+1 — see below) rather than
cutting rows down to a "top N trackers" list. Trimming happened on
**fields**, not **coverage**:

- Dropped the entire `companies` table (2,607 rows of company names, long
  free-text privacy descriptions, contact emails, URLs) — `classify()` only
  ever needs a category, never company metadata.
- Dropped tracker `name`, `website_url`, `ghostery_id`, `notes`, `alias`
  fields — not part of the `classify()` contract.
- Dropped the `categories` table's integer ids — the output uses the
  category name string directly.

The result is a flat `{ "domain": "raw_category_name" }` map: **144,576
bytes** (see the log from the last `build.mjs` run), down from the 1.87MB
source SQL dump. That's small enough to import directly into the service
worker bundle with no runtime fetch or parsing step (see
`src/classifier/tracker-data.ts`), so classification never stalls service
worker startup.

### Registrable-domain collapsing

The dataset sometimes records a specific subdomain (e.g. `graph.facebook.com`
for the "Facebook Social Graph" tracker) separately from the bare domain
(e.g. `facebook.com`, filed under the "Facebook" tracker with a different
category). Our data contract only ever carries a registrable domain
(`NetworkEvent.destinationDomain`, per CLAUDE.md section 5), so all dataset
domain strings are collapsed onto their registrable domain (eTLD+1) using
the same `tldts`-based logic as the request observer. Where that collapsing
causes two different dataset entries to land on the same registrable
domain (250 cases in the current snapshot), the entry whose dataset domain
string already *is* the bare registrable domain wins, since that's the
dataset's own designation for the domain as a whole — the most faithful
choice available once subdomain-level detail is lost.

## Category mapping

The dataset's 11 raw category names are mapped onto Data Lens's `Category`
union in `src/classifier/tracker-data.ts`. See that file for the exact
mapping table and rationale (e.g. why `hosting` → `CDN`).
