# 009 — user-js-performance-tuning

## Goal
Optimized Gecko engine profile configuration template (`user.js`) tailored for fast, low-overhead BiDi QA and testing automation. Strips non-essential background services, telemetry, and heavy UI animations while optimizing cache and network idle triggers.

## Requirements
- R1: Performance preference tuning: inject calibrated Gecko preferences in `.agent/apps/<appSlug>/profile/user.js` to disable non-essential features (telemetry, background update pings, speculative connections, smooth scrolling/heavy CSS transitions).
- R2: Predictable settling: adjust network and DOM timing preferences to improve the reliability of WebDriver BiDi `networkIdle` detection.
- R3: Startup cache preserved: the tuning never disables or relocates Firefox's startup cache (`startupCache`), which already speeds up cold and warm launches by default.
- R4: Non-destructive merge: ensure custom user-defined preferences in `user.js` are preserved without being unconditionally overwritten.

### Who it serves
Agents and test runners that require snappy navigation, consistent network idle settling, and minimized RAM/CPU footprint when driving PWA instances.

### Out of scope
- Content-blocking adblock extensions or invasive HTML mutation.
- Bypassing site security headers.

### Dependencies
- 004 (standalone-pwa-no-extension).

### Owner split
Agent: code, tests, docs. Human: performance benchmark verification.

## Design
### Context

When the remote agent is active (`--remote-debugging-port`), Firefox already applies ~150 automation preferences itself (`remote/shared/RecommendedPreferences.sys.mjs`: telemetry, updates, safe-browsing, first-run pages, hang reports, focus test mode...). They are set on the default branch at runtime, so they never reach `prefs.js` and are absent in clean (`auth`) mode. Duplicating them in `user.js` adds nothing in debug mode, and some of them (e.g. `signon.rememberSignons: false`, `browser.sessionstore.resume_from_crash: false`) would hurt the clean login window, which is a real user session. So the catalog only adds what Firefox does not already tune, and nothing that changes site behaviour or security.

Today `ensureStandaloneProfile` rewrites `user.js` from scratch on every launch, so any line a user adds is lost: that is the R4 bug.

### Approach

- D1 (R1, R2, R3): Catalog `PERFORMANCE_PREFS` in `src/browser/performance-prefs.ts`, data only, each entry with a one-line reason:
  - Deterministic settling: `general.smoothScroll: false`, `toolkit.cosmeticAnimations.enabled: false`, `ui.prefersReducedMotion: 1` (sites honouring `prefers-reduced-motion` drop CSS transitions).
  - No speculative network noise that delays `networkIdle`: `network.dns.disablePrefetch: true`, `network.prefetch-next: false`, `network.http.speculative-parallel-limit: 0`, `network.predictor.enabled: false`, `browser.urlbar.speculativeConnect.enabled: false`, `browser.places.speculativeConnect.enabled: false`.
  - Background work: `browser.pagethumbnails.capturing_disabled: true`, `app.normandy.enabled: false`, `browser.ping-centre.telemetry: false`.
  _(standard: Mozilla prefs reference - https://firefox-source-docs.mozilla.org/modules/libpref/index.html; overlap checked against https://searchfox.org/mozilla-central/source/remote/shared/RecommendedPreferences.sys.mjs; arkenfox user.js comments - https://github.com/arkenfox/user.js)_
- D2 (R4): Pure `mergeUserJs(existing, managed)` in `src/browser/user-js.ts`: pwa-nav owns one block delimited by `// BEGIN pwa-nav managed (do not edit)` / `// END pwa-nav managed`; the block is regenerated, everything outside it is kept byte-for-byte. A pref the user sets outside the block wins: it is omitted from the regenerated block (Firefox applies `user.js` top to bottom, so the order alone would also work, but omitting keeps the file honest). Legacy files without markers (written by older pwa-nav) are treated as fully managed. `serializeUserJs` moves here. _(standard: managed-block pattern of tools editing user-owned config, e.g. arkenfox `user-overrides.js` and `/etc/hosts` blocks)_
- D3 (R1, R4): `ensureStandaloneProfile` reads the existing `user.js` (if any), merges `{...DEFAULT_STANDALONE_USER_PREFS, ...PERFORMANCE_PREFS, ...extraPrefs}` with D2 and writes only when the content changed. The BiDi activation prefs (`remote.active-protocols`, `remote.experimental-modules`) are the only keys a user override cannot remove; they stay in the block.

### Pros / cons and mitigations

| Pro | |
|---|---|
| Fewer animation and prefetch side effects, steadier `networkIdle` | |
| User edits to `user.js` survive relaunches (bug fix) | |

| Con | Mitigation |
|---|---|
| `ui.prefersReducedMotion` changes how some sites look | Only animations; users can override the pref outside the managed block |
| Pref names drift between Firefox versions | Unknown prefs are ignored by Firefox, never an error; catalog has a test pinning names; managed runtime (015) tracks current release |
| Benefit is hard to measure | T-human benchmark: cold launch + `open`→`snapshot` on a fixed app, before/after |
| R3 (startup cache) has no safe knob: the startup cache is already on by default | Recorded as a decision; no pref is added for it |

### Deliverables

- `src/browser/performance-prefs.ts` (D1), `src/browser/user-js.ts` (D2), `src/browser/standalone-profile.ts` (D3).
- Tests: `src/browser/test/user-js.test.ts` (user lines preserved, override wins, BiDi prefs forced, idempotent, legacy file); `standalone-profile.test.ts` updated.

### Sequencing

D2 → D1 → D3.

### Decisions

- R3: no startup-cache tuning; the default is already optimal and the cache folder is excluded from backups in spec 010.

## Tasks
- [x] 009/T001 [agent] mergeUserJs managed-block merger and serializer — covers D2
- [x] 009/T002 [agent] PERFORMANCE_PREFS catalog and ensureStandaloneProfile non-destructive write — covers D1, D3
- [x] 009/T003 [agent] Test: user lines kept, override wins, BiDi prefs forced, idempotent, legacy file, catalog names, no startup cache prefs — covers R1, R2, R3, R4
- [ ] 009/T004 [human] Benchmark cold launch + open/snapshot before and after on one app — covers R1, R2
