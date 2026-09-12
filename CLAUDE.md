# Data Lens — Project Instructions

You are the lead engineer on this project. These instructions apply to every session. Read them before acting.

---

## 1. What we are building

**Data Lens** is a Chrome Manifest V3 extension built for a hackathon.

It observes third-party network requests the browser makes, classifies each destination against a real tracker dataset, detects concrete privacy-relevant signals, explains those observations in plain English using Chrome's on-device Prompt API (Gemini Nano) with a deterministic fallback, and lets the user block a destination.

**The product idea in one line:** don't just tell the user a tracker exists — show what was observed, explain why it may matter, and let them act.

The pipeline:

```
website → network requests → observation → third-party filter →
classification → risk signals → chrome.storage.local → dashboard →
user selects destination → on-device AI or fallback → explanation →
user blocks → reload → changed request pattern
```

**Naming, use these exactly:**
- The product / extension is **Data Lens**
- The controlled demo website is **The Daily Byte** (a fake news site)

Never call the demo site "Data Lens" and never call the product "Privacy Lab". These were earlier names; they are retired.

---

## 2. Hard constraints

- **No backend.** No server of any kind in the MVP.
- **No FastAPI. No SQLite. No database.** Persistence is `chrome.storage.local` only.
- **No external AI API at runtime.** The shipped product must never call OpenAI, Anthropic, Gemini cloud, or any hosted model. The only AI is Chrome's on-device Prompt API.
- **No page content collection.** Request metadata only — never page text, form values, passwords, or request bodies.
- Build only what the current phase specifies. Do not add unrelated features.
- Preserve working code. Make the smallest clean change necessary. Never rewrite working modules without being asked.

(To be clear: the "no external AI" rule is about what the *shipped extension* does at runtime. You, as the coding agent, may of course read code, logs, and fixture data during development.)

---

## 3. The claim rule — the most important rule in this project

This product is an **observation and explanation tool**, not a surveillance detector. It can see network metadata. It cannot see what any company does on its servers.

**Never state or imply, in code, UI copy, fallback templates, or AI prompts:**
- that a company sells, stores, shares, profiles, or monetizes user data
- that a request is malicious, dangerous, or harmful
- anything about server-side behavior

**Third-party does not mean bad.** CDNs are third-party and entirely benign. The UI must never present every third-party request as a threat.

**Acceptable phrasings:**
- "This request is associated with advertising."
- "This destination was observed across multiple sites in this session."
- "This may be consistent with cross-site tracking."
- "A tracking parameter was observed in this request."

The UI must visually separate **OBSERVED FACTS** from **INTERPRETATION**. Facts are what the extension recorded. Interpretation is what the AI or a fallback template says it might mean. A user must always be able to tell which is which.

Never claim a signal was detected unless the extension actually observed it.

---

## 4. Tech stack

Chrome Manifest V3 · TypeScript (strict) · Vite · React (dashboard/popup) · `chrome.storage.local` · `declarativeNetRequest` for blocking · Chrome Prompt API / Gemini Nano · WhoTracks.me tracker dataset.

---

## 5. Data contract — FROZEN after Phase 0

These types are defined in Phase 0 and **must not change** afterwards without an explicit instruction. Everything else is built against them.

```ts
export type Category =
  | 'Analytics'
  | 'Advertising'
  | 'Social'
  | 'CDN'
  | 'Other'
  | 'Unknown';

export type RiskSignalKind =
  | 'known_tracker'
  | 'tracking_parameter'
  | 'cross_site_presence';

export interface RiskSignal {
  kind: RiskSignalKind;
  /** Short factual detail, e.g. "gclid" or "seen on 3 sites". No interpretation. */
  detail?: string;
}

export interface NetworkEvent {
  id: string;
  sourceSite: string;          // registrable domain of the page
  destinationDomain: string;   // registrable domain of the request target
  requestType: string;         // script | image | xmlhttprequest | ...
  timestamp: number;           // epoch ms
  isThirdParty: boolean;
  category: Category;
  knownTracker: boolean;
  riskSignals: RiskSignal[];
  blocked: boolean;
}

export interface Explanation {
  explanation: string;
  whyItMatters: string;
  suggestedAction: string;
  source: 'on-device-ai' | 'fallback';
}
```

**Storage module** — the only place `chrome.storage` is touched. Never call `chrome.storage` directly anywhere else.

```ts
saveNetworkEvent(event: NetworkEvent): Promise<void>
getNetworkEvents(): Promise<NetworkEvent[]>
getEventsForSite(site: string): Promise<NetworkEvent[]>
recordCrossSiteContact(destination: string, sourceSite: string): Promise<void>
getCrossSiteMap(): Promise<Record<string, string[]>>
saveBlockedDestination(domain: string): Promise<void>
getBlockedDestinations(): Promise<string[]>
removeBlockedDestination(domain: string): Promise<void>
clearAll(): Promise<void>
seedFixtures(): Promise<void>
```

Every storage function must handle failure gracefully and never throw into the UI.

---

## 6. Manifest V3 rules that will silently break things

These are not optional. Violating them produces bugs that look like magic.

**6.1 — Service workers terminate.** The MV3 background service worker shuts down after ~30 seconds idle and restarts on the next event.

**6.2 — Register every listener synchronously at the top level** of the service worker file. Never register a listener inside an async function, inside a callback, or after an `await`. If you do, listeners stop firing after the first termination and the bug is extremely hard to trace.

**6.3 — No state may live only in memory.** Anything that accumulates — especially the cross-site presence map — must be persisted through the storage module. In-memory maps are wiped every time the worker sleeps. A short-lived in-memory cache is fine only as a write-through cache over persisted state.

**6.4 — `webRequest` is for observing, `declarativeNetRequest` is for blocking.** Non-blocking `webRequest` observation is still permitted in MV3 — use it to observe. Blocking `webRequest` is gone. Never attempt to block with `webRequest`. Never conflate the two.

---

## 7. Chrome API verification rule

Chrome's extension and AI APIs have changed repeatedly. **Do not implement from memory or from tutorials.** Before implementing anything touching these areas, fetch the current official documentation:

- Request observation: https://developer.chrome.com/docs/extensions/reference/api/webRequest
- Blocking: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Extensions + AI: https://developer.chrome.com/docs/extensions/ai
- Built-in AI setup: https://developer.chrome.com/docs/ai/get-started

If current Chrome restrictions make the spec impossible as written: **stop, explain the restriction plainly, implement the closest correct supported approach, and preserve the intended product behavior.** Do not fake functionality. Do not force a deprecated approach.

---

## 8. Tracker classification

Use the **WhoTracks.me** tracker/category dataset. It is not yet in the repo — Phase 3 acquires it. Check its license and record attribution in the README.

Classification is **deterministic**. A `classify(domain)` function returns `{ category, knownTracker }` from dataset lookup only.

**The AI never classifies.** Gemini Nano explains; it does not decide categories.

If a domain is not in the dataset, `category = 'Unknown'` and `knownTracker = false`. **Never guess a category.** Never invent categories the dataset doesn't contain.

Consider the dataset's size when bundling — if the full database is large, ship a trimmed subset covering common trackers rather than bloating the extension. Load it in a way that doesn't stall service worker startup.

---

## 9. Risk signals — implement exactly these, no others

**Signal 1 — `tracking_parameter`.** Detect `fbclid`, `gclid`, and any `utm_*` parameter in the request URL. Record which parameter was found in `detail`. Do not label the URL malicious.

**Signal 2 — `cross_site_presence`.** Track which source sites have contacted each destination during the session. When a destination has been seen on 2+ distinct source sites, emit the signal with a factual detail like `"seen on 3 sites"`. **This map must be persisted** (see 6.3). Never infer cross-site behavior beyond what was actually observed.

**Signal 3 — `known_tracker`.** Emitted when the dataset lookup returns a known tracker.

**Explicitly out of scope:** third-party cookie detection. It requires fragile `extraHeaders` handling and Chrome's cookie behavior keeps shifting. Do not implement it. Do not suggest implementing it unless explicitly asked.

---

## 10. AI layer

**Input to the model:** only structured observations the extension already made. Nothing else. Never send browsing history, page content, or full URLs.

```json
{
  "domain": "doubleclick.net",
  "category": "Advertising",
  "knownTracker": true,
  "riskSignals": ["tracking_parameter", "cross_site_presence"],
  "sourceSitesObserved": ["thedailybyte.local", "example.com"]
}
```

**System prompt must instruct the model:**

> You are a privacy explanation assistant. You are given only observations made by a browser extension. Explain what these observations mean in simple, accurate language. Do not claim knowledge of server-side behavior that was not observed. Do not claim that a company sells, stores, profiles, shares, or monetizes user data unless that is explicitly present in the supplied evidence. Do not call a request malicious merely because it is third-party. Distinguish what was observed from what it may indicate. Give a concise plain-English explanation, why it may matter, and one practical suggested action.

**Availability handling.** Check availability before use. Handle `available`, `downloadable`, `downloading`, and `unavailable` as distinct UI states. A downloading model shows "On-device AI is preparing…". An unavailable model falls back silently and correctly. **The extension must never break because the model is missing.**

**Session management.** One dedicated explainer service owns availability checks, session creation, prompting, error handling, and fallback. Reuse sessions sensibly — do not create a new session per request. The rest of the app must not know or care whether an explanation came from Gemini Nano or a template.

**Output.** Prefer structured output matching the `Explanation` interface. If structured output is unreliable, use a constrained text format and parse defensively. Malformed model output must never crash the dashboard.

**Performance.** Never run inference per network request. Classification and risk detection are cheap and run on every event; AI runs **only when the user asks to explain a specific destination.**

---

## 11. Fallback explanations

Deterministic templates for `Analytics`, `Advertising`, `Social`, `CDN`, `Other`, `Unknown`. They must incorporate observed risk signals — especially cross-site presence and tracking parameters.

They must be good enough to carry the live demo alone. Write them as carefully as you'd write shipped product copy, and hold them to the claim rule in section 3.

The UI must label which source produced an explanation (on-device AI vs. built-in explanation) without making the fallback look broken or second-rate.

---

## 12. Blocking

`declarativeNetRequest` dynamic or session rules only.

Must: validate the domain, prevent duplicate rules, persist blocked destinations, reflect blocked state in the UI, and support removal.

**Never report a block succeeded unless Chrome actually accepted the rule.** If blocking genuinely can't work in a scenario, show an honest "marked suspicious" state instead of pretending.

---

## 13. UI principles

The dashboard should feel like a real privacy product, not a student project.

Prioritize clarity, hierarchy, readability, useful information density, clean cards, obvious actions, and clear risk indicators.

Avoid excessive animation, gradients, decorative elements, clutter, walls of text, and generic AI-app styling.

A user should immediately understand: *What is this site talking to? Why might it matter? What can I do?*

**Main view shows:** current site, third-party request count, category counts, destination list with category and signal indicators.

**Detail view shows:** domain, category, known-tracker status, risk signals, cross-site presence, an explanation area, a suggested action, and a block button — with observed facts visually separated from interpretation.

---

## 14. Code quality

Strict TypeScript. Clear interfaces. Small modules with single responsibilities. Meaningful names. Real error handling. Reusable components.

**Do not:** put logic in `App.tsx` or `service-worker.ts` that belongs in a module; mix UI, classification, storage, and AI concerns; use `any` to escape a type problem; hard-code domain lists; swallow errors; or leave placeholder implementations in core paths.

**Error handling is mandatory** for: AI unavailable, AI downloading, AI prompt failure, storage read failure, storage write failure, unknown domains, missing tracker data, malformed request metadata, and blocking rule failure. Use graceful states. Never silently pretend something worked.

---

## 15. Project structure

```
data-lens/
├── src/
│   ├── background/     service-worker.ts, request-observer.ts
│   ├── classifier/     classifier.ts, tracker-data.ts, risk-signals.ts
│   ├── ai/             explainer.ts, prompt.ts, fallback.ts
│   ├── storage/        storage.ts
│   ├── blocking/       blocker.ts
│   ├── popup/          App.tsx, components/, styles/
│   ├── types/          index.ts
│   ├── fixtures/       sample-events.ts
│   └── utils/
├── data/whotracks/
├── demo-site/
├── public/
├── manifest.json
└── ...config files
```

Adjust if implementation genuinely requires it, but keep the separation of responsibilities.

---

## 16. Fixtures

`src/fixtures/sample-events.ts` holds a realistic `NetworkEvent[]` covering every category, both tracker and unknown domains, and a cross-site-presence case.

Purpose: the dashboard can be built and tested without live capture, and the demo has a fallback if live capture misbehaves on stage. Expose a dev-only way to seed storage from fixtures.

---

## 17. How to work with me

For each phase:

1. Inspect the existing project first.
2. Briefly state your implementation plan.
3. Implement it.
4. Build and test whatever can be tested.
5. Fix errors you find.
6. Report exactly what changed (file by file).
7. Give exact manual test steps.
8. State what success looks like.
9. **Stop. Do not start the next phase unless explicitly asked.**

Do not dump enormous amounts of code without explanation. Explain important architectural decisions as you make them. When API behavior is uncertain, verify against real documentation rather than guessing.

If a phase is fundamentally broken, say so plainly rather than proceeding.
