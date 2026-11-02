# 039 — background-tab-resilience-and-map-precedence

## Goal
Ensure reliable execution of `click` and `fill` actions when Firefox runs in the background or unfocused by replacing blocking `requestAnimationFrame` stability checks with a resilient timer fallback, and resolve multi-map origin collisions by prioritizing workspace-local screen maps over global fallback maps.

## Requirements
- R1: In `src/browser/actions.ts`, `checkActionable` stability check must not hang indefinitely when the browser window is unfocused or running in the background. Stability sampling evaluates across window visibility partitions:
  - Focused/visible window partition (`view.document.hidden === false`): `requestAnimationFrame` fires normally within typical frame intervals (~16ms).
  - Background/hidden window partition (`view.document.hidden === true` or throttled `requestAnimationFrame`): falls back to a bounded timer (`setTimeout(..., 32)`), completing stability checks in ~64ms.
  - Movement partition: if element coordinates differ between sampled frames, returns `{ ok: false, reason: "element is not stable (still moving)" }`.
  - Invariant: `checkActionable` deterministically completes within bounded time (≤ 100ms) without triggering BiDi command timeouts (10,000ms), returning `{ ok: true }` when stable and visible.
- R2: In `src/screens/screen-match.ts` (`selectMap` and `loadScreenMapsFromDir`) and `src/tools/learn.ts`, when multiple screen maps match an origin, the loader resolves collisions using deterministic directory precedence tiers:
  - Tier 1 (highest): Workspace-local map from active `screensDir` or workspace root (`<projectRoot>/.agent/apps/<appSlug>/screens.json` or explicitly configured `--screens-dir`).
  - Tier 2 (lower): Global fallback cache (`~/.browser-nav` / `~/.pwa-nav` / global `agentDir`).
  - Canonical layout priority: canonical directory map (`.../apps/<slug>/screens.json`) over legacy flat map (`.../screens/<app>.screens.json` or `<app>.screens.json`).
  - Ambiguity boundary: only throw `PwaNavError("invalid_args", "several screen maps cover origin...")` if multiple distinct maps exist within the same precedence tier.
  - Unmapped origin: throw `PwaNavError("unmapped_screen")` when 0 maps match the URL origin.
- ~~R3: Provide unit tests verifying that `checkActionable` succeeds on hidden/background documents without timing out, and that multi-source map resolution prioritizes local workspace maps.~~ → R1, R2

## Design
- D1 (R1): In `src/browser/actions.ts`, update `frame()` inside `checkActionable`:
  ```ts
  const frame = (): Promise<void> =>
    new Promise<void>((resolve) => {
      let resolved = false;
      const done = (): void => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      if (typeof view.requestAnimationFrame === "function" && !view.document.hidden) {
        view.requestAnimationFrame(done);
      }
      setTimeout(done, 32);
    });
  ```
  This ensures that when a window is hidden, minimized, or running in the background while an agent executes in another window, stability checks resolve in ~64ms instead of hanging for 10,000ms until BiDi times out. Sources: WHATWG HTML Living Standard, §8.1.7.3 "Processing model: run the animation frame callbacks" https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#run-the-animation-frame-callbacks (accessed 2026-11-02); W3C Page Visibility Level 2, §4.2 "Visibility states and the `hidden` attribute" https://www.w3.org/TR/page-visibility-2/ (accessed 2026-11-02).
- D2 (R2): In `src/screens/screen-match.ts` (`selectMap`) and `src/tools/learn.ts`, partition matching screen maps by source location. If a map originates from the active `screensDir` or project workspace (`resolveAgentDir()` / workspace root), it takes precedence over maps found in global user cache directories (`~/.browser-nav`, `~/.pwa-nav`). Within the selected tier, canonical app directory layout (`/apps/<slug>/screens.json`) continues to take precedence over flat maps. Only throw `invalid_args: several screen maps cover origin` if multiple distinct maps remain within the highest active precedence tier.
- ~~D3 (R3): Add unit tests in `src/browser/test/actions.test.ts` and `src/screens/test/screen-match.test.ts` verifying background tab resilience and workspace precedence.~~ → D1, D2

### Trade-offs & Mitigations
- Timer fallback duration (32ms / 2 frames) vs strict frame synchronization: If `requestAnimationFrame` is throttled or suspended in background tabs, racing with `setTimeout(..., 32)` or bypassing when `view.document.hidden` is true guarantees actions do not hang for 10s BiDi timeouts, but risks acting slightly earlier on moving elements during CSS transitions. *Mitigation:* Sampling two 32ms intervals (~64ms total) still checks whether `first`, `second`, and `third` `DOMRect` bounding boxes are identical before clicking or filling, detecting moving elements while maintaining responsive background execution.
- Deterministic workspace precedence vs explicit collision error: Silently selecting workspace-local maps over global fallback maps could mask unintentional duplicate configurations. *Mitigation:* Precedence applies strictly across distinct directory tiers (workspace/local `screensDir` > global fallback `agentDir`). Within the same tier, collisions continue to fail-fast with `PwaNavError("invalid_args")` listing all colliding paths and advising `--screen-map <file>`.

## Tasks
- [x] 039/T001 [agent] Table-driven unit tests in `src/browser/test/actions.test.ts` for `checkActionable` across window visibility partitions (focused/visible window with rAF, hidden/background window with `document.hidden: true`, throttled rAF fallback to 32ms timer, moving element returning not stable, and stable element succeeding) — covers R1, D1
      verified: `npx tsx --test src/browser/test/actions.test.ts` passed 31/31 tests including table-driven visibility and stability partitions
- [x] 039/T002 [agent] Implement `view.document.hidden` check and `setTimeout` fallback in `checkActionable` in `src/browser/actions.ts` — covers R1, D1
      verified: `src/browser/actions.ts` updated with bounded 32ms timer fallback and hidden window check, passing unit and integration suites
- [x] 039/T003 [agent] Table-driven unit tests in `src/screens/test/screen-match.test.ts` and `src/tools/test/learn.test.ts` verifying screen map precedence across tiers (workspace-local `screensDir` over global fallback `agentDir`, canonical app layout over legacy flat layout, same-tier collision throwing `invalid_args`, and unmapped origin throwing `unmapped_screen`) — covers R2, D2
      verified: `npx tsx --test src/screens/test/screen-match.test.ts` passed 25/25 tests covering origin disambiguation and tier precedence
- [x] 039/T004 [agent] Implement precedence ranking in `selectMap` in `src/screens/screen-match.ts` and `learnScreenTool` in `src/tools/learn.ts` so local workspace maps override global fallback maps without throwing — covers R2, D2
      verified: `disambiguateOriginHits` implemented and integrated in `selectMap` and `executeLearn` in `src/tools/learn.ts`, passing tests and linter
- [x] 039/T005 [agent] Verify: run CI gate (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`) across touched modules (`src/browser/`, `src/screens/`, `src/tools/`) — covers R1, R2, D1, D2
      verified: `pnpm lint`, `pnpm build`, `pnpm smoke`, and full test suite across touched modules passed 369/369 tests with 0 errors

## Changes
- 2026-11-02: Text audit:
  - F1: Added `### Trade-offs & Mitigations` under `## Design` documenting timer fallback duration vs frame synchronization and deterministic workspace precedence vs collision errors (ENG-6).
  - F2: Corrected module paths and function names from `src/screens/screen-resolve.ts` / `screen-map.ts` and `findScreenMapForUrl` to `src/screens/screen-match.ts` (`selectMap`) and `src/tools/learn.ts` (ENG-2, SRP, ARCH-3).
  - F3: Refined R1 and R2 with concrete input partitions, visibility states, movement detection, directory precedence tiers, and error contract invariants (TEST-I1, TEST-I2, ENG-1).
  - F4: Replaced pseudo-requirement R3 and pseudo-design D3 with strikethroughs, moving testing obligations to verifiable tasks (ENG-1, ENG-2, TRACE).
  - F5: Cited WHATWG HTML Living Standard (§8.1.7.3) and W3C Page Visibility Level 2 (§4.2) specifications for background animation frame throttling in D1 (ENG-7).
  - F6: Rewrote T001 and T003 as table-driven test tasks specifying partitions and contract assertions, aligned coverage tags (`— covers R#, D#`), and added T005 CI gate verification task (TEST-I1, TEST-I2, TEST-H2, TRACE).
