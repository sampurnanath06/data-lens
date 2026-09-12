# Data Lens

A Chrome Manifest V3 extension that observes third-party network requests,
classifies destinations against a real tracker dataset, detects concrete
privacy-relevant signals, explains them in plain English (on-device AI with
a deterministic fallback), and lets the user block a destination.

See `CLAUDE.md` for the full product spec and constraints.

## Development

```
npm install
npm run build      # builds the extension into dist/
npm run demo       # serves the demo site (The Daily Byte) at http://localhost:8000
```

Load `dist/` as an unpacked extension via `chrome://extensions` (Developer
mode → Load unpacked).

## Data & attribution

Tracker classification uses a dataset derived from
[Ghostery TrackerDB](https://github.com/ghostery/trackerdb), distributed via
[WhoTracks.me](https://github.com/whotracksme/whotracks.me), licensed
**CC-BY-NC-SA-4.0** (Creative Commons Attribution-NonCommercial-ShareAlike
4.0), Copyright Ghostery GmbH —
https://creativecommons.org/licenses/by-nc-sa/4.0/.

This is a non-commercial license. It's compatible with this project's
current status as a hackathon/demo build; it would need to be revisited
before any commercial distribution of the tracker dataset specifically.

Full detail on what was bundled, how it was trimmed, and how to regenerate
it: [`data/whotracks/README.md`](data/whotracks/README.md).

No other third-party data is bundled. No external AI API is called at
runtime — the only AI involved is Chrome's on-device Prompt API (Gemini
Nano), per CLAUDE.md section 2.
