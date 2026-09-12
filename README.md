# Data Lens

Data Lens is a Chrome Manifest V3 extension. It watches the third-party
network requests a page makes, classifies each destination against a real
tracker dataset, detects a small number of concrete privacy signals, lets
you ask an on-device AI (or a deterministic fallback) to explain a
destination in plain English, and lets you block it.

The point is not "found a tracker, panic." It's: show what was actually
observed, separate that from what it might mean, and let you act on it.
See `CLAUDE.md` for the full product spec this was built against.

## What it does

For every third-party network request a page makes, Data Lens records the
source site, the destination's registrable domain, the request type, and a
timestamp. Each destination is classified (Analytics / Advertising / Social
/ CDN / Other / Unknown) via dataset lookup — never guessed — and checked
for three factual signals: whether it's a known tracker, whether the
request URL carried a tracking parameter (`gclid`, `fbclid`, `utm_*`), and
whether the same destination has been contacted from 2+ different sites
this session. Clicking a destination opens a detail view with two
explicitly separated sections — **Observed facts** (what was actually
recorded) and **Interpretation** (an AI or template-generated explanation
of what that might mean) — plus a button to block the destination going
forward.

## Architecture

```
src/
├── background/    service-worker.ts, request-observer.ts
├── classifier/     classifier.ts, tracker-data.ts, risk-signals.ts
├── ai/              explainer.ts, prompt.ts, fallback.ts, language-model.d.ts
├── storage/        storage.ts
├── blocking/       blocker.ts
├── popup/          App.tsx, components/, lib/, styles/
├── types/          index.ts
├── fixtures/       sample-events.ts
└── utils/          domain.ts
data/whotracks/      trackers.json + build.mjs (see its own README)
demo-site/           The Daily Byte — a controlled demo site (see its own README)
```

The pipeline: `webRequest` observes → registrable-domain extraction
(`utils/domain.ts`, via `tldts` — not naive dot-splitting) → first-party
requests are filtered out → `classifier/` does dataset lookup and risk-signal
detection → `storage/` persists the event → the popup dashboard reads it
back → on request, `ai/` explains a destination → `blocking/` can block it.

**Module ownership** (how this would split across a team):

| Module | Owns | Never touches |
|---|---|---|
| `background/` | `webRequest` observation, third-party filtering, wiring classification + signals + blocked-status onto each event | `chrome.storage` directly, blocking |
| `classifier/` | Dataset lookup → category/knownTracker, the three risk signals | Storage, AI, UI |
| `storage/` | The only code that touches `chrome.storage.local` | Business logic — it's a dumb, defensive key/value layer |
| `ai/` | Prompt API availability/session lifecycle, prompting, defensive parsing, the fallback templates, choosing which one wins | `chrome.storage`, DOM |
| `blocking/` | `declarativeNetRequest` dynamic rules, domain validation, confirming Chrome actually accepted a rule | `webRequest` (never used for blocking) |
| `popup/` | Dashboard UI — reads from `storage/`, calls `ai/` and `blocking/` for actions | Never talks to `background/` or `chrome.webRequest` directly |

The data contract in `types/index.ts` (`NetworkEvent`, `RiskSignal`,
`Explanation`, `Category`) is shared by all of the above and is treated as
frozen — every module is built against it rather than each other's
internals.

Vite builds a plain multi-entry bundle (`popup` + `service-worker`) instead
of using a manifest-driven plugin like `@crxjs/vite-plugin` — this keeps
full control over output filenames, which the static `manifest.json`
references directly, and avoids depending on a third-party plugin's release
cadence mid-build. See `vite.config.ts`.

## Setup

```
npm install
npm run build      # tsc -b && vite build — outputs to dist/
```

If `npm`/`node` aren't on your shell's PATH, call them by full path (e.g. on
Windows, `& "C:\Program Files\nodejs\node.exe" node_modules\vite\bin\vite.js build`).

Other scripts: `npm run dev` (Vite dev server — not how the extension itself
loads, useful for iterating on popup markup/styles in a browser tab),
`npm run typecheck` (`tsc -b --noEmit`, no build output), `npm run demo`
(serves the demo site, see below).

## Loading the extension

1. `npm run build`.
2. Chrome → `chrome://extensions` → enable **Developer mode** (top right).
3. **Load unpacked** → select the `dist/` folder.
4. After any rebuild, click the reload icon on the extension's card — Chrome
   does not pick up `dist/` changes automatically.

## Running the demo site

The Daily Byte (`demo-site/`) is a plain fake news site that fires a fixed
set of requests to real tracker/CDN domains on load, so the demo doesn't
depend on live internet browsing to specific real trackers.

```
npm run demo
```

Serves on `http://localhost:8000` by default (`PORT=5050 npm run demo` to
override). Visit **both** `http://localhost:8000` and
`http://127.0.0.1:8000` — Chrome treats them as distinct sites, which is
what makes the `cross_site_presence` signal demonstrable without a second
real deployment. Full detail: `demo-site/README.md`.

## The dashboard, without live browsing

Open the popup and click **"Load sample data"** in the dev/demo tools
footer — this seeds `chrome.storage.local` from `src/fixtures/sample-events.ts`,
a realistic dataset covering every category, a known tracker, an
`Unknown` domain, and a destination observed across 3 sites. Useful for
development, and as a fallback if live capture misbehaves on stage.
**"Clear stored data"** wipes everything (fixtures and real captures alike).

## Gemini Nano (on-device AI) and what happens without it

Clicking **"Explain with on-device AI"** in the detail view calls
`src/ai/explainer.ts`, the single owner of the whole explanation path. It
checks `LanguageModel.availability()` and handles all four states Chrome
defines:

- **`available`** — prompts immediately.
- **`downloadable` / `downloading`** — shows "On-device AI is preparing…"
  while Chrome fetches the model (this can be large and slow the first
  time; see Known limitations).
- **`unavailable`**, or the `LanguageModel` global doesn't exist at all
  (old Chrome, flag off, non-Chrome browser) — falls back immediately.

**Nothing is ever left broken.** If the model is unavailable, download
fails, prompting fails, or the model's output doesn't parse as valid JSON,
`explainer.ts` silently and safely falls back to `src/ai/fallback.ts` — a
deterministic, hand-written template per category that incorporates the
same risk signals (which tracking parameter, how many sites) an AI
explanation would. Every result is labeled with its actual source ("On-device
AI" or "Built-in explanation") so nothing pretends to be something it
isn't; the fallback is styled as a first-class result, not a degraded one.

To actually exercise the on-device AI path (not just the fallback), your
machine needs the Prompt API flags enabled in `chrome://flags`
(`#optimization-guide-on-device-model`, `#prompt-api-for-gemini-nano`) and
the model downloaded via `chrome://components` → "Optimization Guide On
Device Model" → Check for update. Without that setup, every explanation
you see will legitimately be the fallback — which is by design, not a bug.

Only the minimal structured observation ever reaches the model — domain,
category, `knownTracker`, risk signal *kinds* (not the specific tracking
parameter value or site names), and the list of source sites. Never
browsing history, page content, or full URLs.

## Blocking

Clicking **"Block this destination"** calls `src/blocking/blocker.ts`,
which uses `declarativeNetRequest` **dynamic rules** (never `webRequest` —
blocking via `webRequest` doesn't exist in MV3). It validates the domain,
checks existing rules to avoid duplicates, adds the rule, then **re-reads
the active rules to confirm Chrome actually accepted it** before ever
reporting success or persisting the blocked state — a resolved
`updateDynamicRules()` promise alone isn't treated as proof. If Chrome
doesn't confirm the rule, the UI shows an honest inline message instead of
pretending it worked. Blocked state is reflected in both the main list and
the detail view, and dynamic rules persist across browser restarts.

## WhoTracks.me / TrackerDB attribution and license

Tracker classification data comes from
[Ghostery TrackerDB](https://github.com/ghostery/trackerdb), distributed
via [WhoTracks.me](https://github.com/whotracksme/whotracks.me), licensed
**CC-BY-NC-SA-4.0** (Creative Commons Attribution-NonCommercial-ShareAlike
4.0), Copyright Ghostery GmbH —
https://creativecommons.org/licenses/by-nc-sa/4.0/.

**This is a non-commercial license.** Fine for this project's current
status as a hackathon/demo build; it would need a different data source or
a license from Ghostery before any commercial distribution specifically of
the tracker dataset. Full detail on what was bundled, how it was trimmed
(144KB, every domain kept, only unneeded fields dropped), and how to
regenerate it: [`data/whotracks/README.md`](data/whotracks/README.md).

No other third-party data is bundled. No external AI API is called at
runtime — the only AI involved is Chrome's on-device Prompt API.

## Known limitations (stated honestly)

- **Tracker coverage stops where the dataset stops.** ~4,750 registrable
  domains. Real trackers outside it classify `Unknown` rather than being
  guessed at — by design (never invent a category), but it does mean
  coverage has a real, visible ceiling, especially for newer or regional
  trackers.
- **Registrable-domain granularity only.** A handful of dataset entries
  distinguish specific subdomains with different categories (e.g. a
  tracking-pixel subdomain vs. the bare domain); collapsed to eTLD+1 per the
  frozen data contract, one wins deterministically (see
  `data/whotracks/README.md`), so very occasionally a domain's category
  reflects a sibling subdomain's classification rather than the exact one
  hit.
- **The on-device AI path needs real setup** (Chrome flags + a large model
  download) that most machines won't have out of the box. The fallback is
  intentionally strong enough to carry an entire demo alone, but "AI"
  specifically requires that setup to actually engage, not just be present
  in the code.
- **No third-party cookie detection.** Explicitly out of scope per the
  product spec — Chrome's cookie APIs and behavior here are fragile and
  keep shifting; the three implemented signals (known tracker, tracking
  parameter, cross-site presence) don't depend on them.
- **`webRequest` observation, not guaranteed capture.** A request that
  completes before the service worker has finished waking from termination,
  or one Chrome doesn't route through `onBeforeRequest` for some resource
  types, won't be recorded. In practice this is rare for normal page loads.
- **Session-scoped cross-site presence.** The cross-site map persists in
  `chrome.storage.local` (survives service worker restarts, per CLAUDE.md
  6.3), but nothing currently ages it out — it's a running total since
  install (or since it was last cleared), not a rolling recent-session
  window.
- **Single popup surface.** No options page, no persistent tab view, no
  cross-device sync — everything lives in the toolbar popup and
  `chrome.storage.local` (local to the browser profile).
- **This build hasn't been automatically verified inside a real loaded
  extension.** Branded Google Chrome rejects `--load-extension` from the
  command line entirely (`--load-extension is not allowed in Google Chrome,
  ignoring`), which blocked automated headless verification of the actual
  popup/service-worker runtime throughout this project. Everything here has
  been verified by static type-checking, build success, and exercising the
  non-Chrome-dependent logic (classifier, fallback templates, blocker's
  validation/hashing) directly in Node — the loaded-extension behavior
  itself has been verified by manual testing in a real browser.
