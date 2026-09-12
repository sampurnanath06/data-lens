# The Daily Byte (demo site)

A plain, believable fake news site used to demonstrate Data Lens. It is not
a real news publication and makes no attempt to look like one.

## Running it

From the repository root:

```
npm run demo
```

This starts a small static file server (no dependencies, built on Node's
`http` module) on port 8000 by default. Override the port with:

```
PORT=5050 npm run demo
```

Then load it in Chrome with Data Lens installed:

- http://localhost:8000
- http://127.0.0.1:8000

## Cross-site testing note

The server binds to all network interfaces, so the exact same page is
reachable at both `http://localhost:PORT` and `http://127.0.0.1:PORT`.
Chrome treats these as two distinct origins/sites (different hostnames),
even though it's the same server and the same HTML. For Data Lens purposes
this means visiting both URLs in the same browser session is sufficient to
simulate "the same tracker seen across two different sites" and exercise
the `cross_site_presence` risk signal — no second site or deployment is
needed.

## What it does

On page load, `script.js` fires a fixed set of third-party requests to real,
recognizable tracker/CDN domains (chosen so they classify correctly against
the WhoTracks.me dataset instead of falling back to `Unknown`):

| Destination | Category | Request type | Tracking parameter |
|---|---|---|---|
| `www.google-analytics.com` | Analytics | image pixel | — |
| `ad.doubleclick.net` | Advertising | image pixel | `gclid` |
| `connect.facebook.net` | Social | script (real `fbevents.js`) | `fbclid` |
| `cdnjs.cloudflare.com` | CDN | script (real `dayjs` library, actually loads) | — |
| `sb.scorecardresearch.com` | Analytics | fetch/beacon | `utm_source` |

These requests are expected to fail, get blocked by Chrome, or return
non-200 responses in some cases (e.g. the tracking pixels use made-up
IDs) — that's fine. Data Lens's request observer fires on the request
attempt itself, not on a successful response, so a failed request still
produces an observable event. Only the CDN request needs to actually
succeed, and it does: `dayjs.min.js` is a real, small, publicly hosted
library file.

No page content, form values, or request bodies are read or transmitted by
this demo site beyond the fixed URLs above.
