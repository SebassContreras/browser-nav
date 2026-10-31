# 039 — background-tab-resilience-and-map-precedence

## Goal
Ensure reliable execution of `click` and `fill` actions when Firefox runs in the background or unfocused by replacing blocking `requestAnimationFrame` stability checks with a resilient timer fallback, and resolve multi-map origin collisions by prioritizing workspace-local screen maps over global fallback maps.

## Requirements
- R1: In `src/browser/actions.ts`, `checkActionable` stability check must not hang indefinitely when the browser window is unfocused/backgrounded. It must race `requestAnimationFrame` with a bounded timer fallback (`setTimeout(..., 32)`) or use `setTimeout` when `view.document.hidden` is true.
- R2: In `src/screens/screen-resolve.ts` / `src/screens/screen-map.ts`, when multiple screen maps match an origin (e.g. one in `screensDir` / `workspaceDir` and another in global `agentDir`), the loader deterministically selects the workspace-local screen map instead of throwing `invalid_args: several screen maps cover origin`.
- R3: Provide unit tests verifying that `checkActionable` succeeds on hidden/background documents without timing out, and that multi-source map resolution prioritizes local workspace maps.

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
  This ensures that when a window is hidden, minimized, or running in the background while an agent executes in another window, stability checks resolve in ~64ms instead of hanging for 10,000ms until BiDi times out.
- D2 (R2): In `src/screens/screen-resolve.ts` / `src/screens/screen-map.ts`, partition matching screen maps by source location. If a map originates from the active `screensDir` or `workspaceDir`, it takes precedence over maps found in global `agentDir`. Only throw `invalid_args: several screen maps cover origin` if multiple distinct maps exist within the same precedence tier.
- D3 (R3): Add unit tests in `src/browser/test/actions.test.ts` and `src/screens/test/screen-match.test.ts` verifying background tab resilience and workspace precedence.

## Tasks
- [ ] 039/T001 [agent] Unit test in `src/browser/test/actions.test.ts` for `checkActionable` frame resolution under background/hidden window conditions — covers R1
- [ ] 039/T002 [agent] Implement `view.document.hidden` check and `setTimeout` fallback in `checkActionable` in `src/browser/actions.ts` — covers D1
- [ ] 039/T003 [agent] Unit test in `src/screens/test/screen-match.test.ts` verifying workspace-local screen map precedence over global fallback maps — covers R2
- [ ] 039/T004 [agent] Implement precedence ranking in `findScreenMapForUrl` / screen map loading so local workspace maps override global fallback maps without throwing — covers D2
