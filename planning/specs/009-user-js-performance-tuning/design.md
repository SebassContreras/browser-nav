# 009 - user-js-performance-tuning - Design

## Context

When the remote agent is active (`--remote-debugging-port`), Firefox already applies ~150 automation preferences itself (`remote/shared/RecommendedPreferences.sys.mjs`: telemetry, updates, safe-browsing, first-run pages, hang reports, focus test mode...). They are set on the default branch at runtime, so they never reach `prefs.js` and are absent in clean (`auth`) mode. Duplicating them in `user.js` adds nothing in debug mode, and some of them (e.g. `signon.rememberSignons: false`, `browser.sessionstore.resume_from_crash: false`) would hurt the clean login window, which is a real user session. So the catalog only adds what Firefox does not already tune, and nothing that changes site behaviour or security.

Today `ensureStandaloneProfile` rewrites `user.js` from scratch on every launch, so any line a user adds is lost: that is the R4 bug.

## Approach

- D1@1 (implements R1, R2, R3): Catalog `PERFORMANCE_PREFS` in `src/browser/performance-prefs.ts`, data only, each entry with a one-line reason:
  - Deterministic settling: `general.smoothScroll: false`, `toolkit.cosmeticAnimations.enabled: false`, `ui.prefersReducedMotion: 1` (sites honouring `prefers-reduced-motion` drop CSS transitions).
  - No speculative network noise that delays `networkIdle`: `network.dns.disablePrefetch: true`, `network.prefetch-next: false`, `network.http.speculative-parallel-limit: 0`, `network.predictor.enabled: false`, `browser.urlbar.speculativeConnect.enabled: false`, `browser.places.speculativeConnect.enabled: false`.
  - Background work: `browser.pagethumbnails.capturing_disabled: true`, `app.normandy.enabled: false`, `browser.ping-centre.telemetry: false`.
  _(standard: Mozilla prefs reference - https://firefox-source-docs.mozilla.org/modules/libpref/index.html; overlap checked against https://searchfox.org/mozilla-central/source/remote/shared/RecommendedPreferences.sys.mjs; arkenfox user.js comments - https://github.com/arkenfox/user.js)_
- D2@1 (implements R4): Pure `mergeUserJs(existing, managed)` in `src/browser/user-js.ts`: pwa-nav owns one block delimited by `// BEGIN pwa-nav managed (do not edit)` / `// END pwa-nav managed`; the block is regenerated, everything outside it is kept byte-for-byte. A pref the user sets outside the block wins: it is omitted from the regenerated block (Firefox applies `user.js` top to bottom, so the order alone would also work, but omitting keeps the file honest). Legacy files without markers (written by older pwa-nav) are treated as fully managed. `serializeUserJs` moves here. _(standard: managed-block pattern of tools editing user-owned config, e.g. arkenfox `user-overrides.js` and `/etc/hosts` blocks)_
- D3@1 (implements R1, R4): `ensureStandaloneProfile` reads the existing `user.js` (if any), merges `{...DEFAULT_STANDALONE_USER_PREFS, ...PERFORMANCE_PREFS, ...extraPrefs}` with D2 and writes only when the content changed. The BiDi activation prefs (`remote.active-protocols`, `remote.experimental-modules`) are the only keys a user override cannot remove; they stay in the block.

## Pros / cons and mitigations

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

## Deliverables

- `src/browser/performance-prefs.ts` (D1), `src/browser/user-js.ts` (D2), `src/browser/standalone-profile.ts` (D3).
- Tests: `src/browser/test/user-js.test.ts` (user lines preserved, override wins, BiDi prefs forced, idempotent, legacy file); `standalone-profile.test.ts` updated.

## Sequencing

D2 → D1 → D3.

## Decisions

- R3: no startup-cache tuning; the default is already optimal and the cache folder is excluded from backups in spec 010.
