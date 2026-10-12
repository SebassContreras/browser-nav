# 009 - user-js-performance-tuning - Design

## Approach

- D1@1 (implements R1, R2, R3): Define a structured performance preferences catalog `PERFORMANCE_TUNING_PREFS` in `src/browser/performance-tuning.ts` categorizing Gecko options for headless/automated QA: telemetry disablement, disabling speculative DNS/TCP preconnections, disabling CSS smooth scroll/transitions for deterministic DOM settling, and caching optimizations for fast re-launches. _(standard: Mozilla Gecko Preferences - https://developer.mozilla.org/en-US/docs/Mozilla/Preferences/A_brief_guide_to_preferences)_
- D2@1 (implements R4): Implement a non-destructive preferences merger `mergeUserJs(existingContent, tuningPrefs)` that parses existing `user.js` assignments, respects explicit user overrides, and appends or updates managed tuning preferences without obliterating user-specified flags. _(standard: Firefox user.js syntax format)_
- D3@1 (implements R1, R2, R4): Refactor `ensureStandaloneProfile` in `src/browser/standalone-profile.ts` into a composable workflow that reads any existing `user.js`, applies the tuning template non-destructively, and ensures required WebDriver BiDi flags remain intact. _(judgement, no standard)_

## Deliverables

- `src/browser/performance-tuning.ts`: `PERFORMANCE_TUNING_PREFS`, parser, and non-destructive `mergeUserJs` utility (D1, D2).
- Updates to `src/browser/standalone-profile.ts`: Integrate `mergeUserJs` into profile initialization and update lifecycles (D3).
- Unit tests in `src/browser/test/performance-tuning.test.ts` verifying preference parsing, preservation of user flags, and idempotence.
- Integration test in `src/browser/test/standalone-profile.test.ts` verifying final generated `user.js`.

## Sequencing

1. D1, D2: Preference catalog and non-destructive user.js parser/merger with unit tests.
2. D3: Integration with `ensureStandaloneProfile` in `src/browser/standalone-profile.ts`.

## Open questions

None.
