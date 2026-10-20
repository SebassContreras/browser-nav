# 017 - code-audit-cleanup - Design

## Context

The audit of `pwa-nav` highlighted technical debt accumulated across iterative specs:
- Redundant forwarding adapter `cli-screens` (Middle Man code smell).
- Four unconsumed internal barrel files (`backend/index`, `core/index`, `ops/index`, `screens/index`).
- Outdated `--clean` and `--debug` flags listed in `pwa-nav auth --help`.
- Unexported utility functions in `src/screens/screen-learn.ts` exposed needlessly to the module boundary.
- Unused legacy `target="id=value"` syntax in `src/tools/click.ts`.
- Top-level synchronous filesystem operations in `src/ops/ops.ts` during module initialization.
- Type errors in test mocks that prevent clean compilation under `tsc --noEmit`.

## Approach

- D1@1 (implements R1): Remove Middle Man `cli-screens` and dispatch semantic actions directly in `src/cli.ts`.
  - Refactor `cmdClick`, `cmdFill`, `cmdUpload`, `cmdAct`, `cmdSnapshot` in `src/cli.ts` to call `clickTool`, `fillTool`, `uploadTool`, `actTool`, `snapshotTool`, and `renderScreenViewForBackend` directly from `src/tools/`.
  - Delete `cli-screens` and its test file `src/cli/test/cli-screens.test.ts` (if any, or re-target to `src/cli/test/cli.test.ts`).
  - _(standard: Martin Fowler Refactoring - Remove Middle Man — https://refactoring.com/catalog/removeMiddleMan.html)_
- D2@1 (implements R2): Delete orphan barrel files.
  - Remove `backend/index`, `core/index`, `ops/index`, and `screens/index`.
  - Maintain `src/index.ts` as the sole public package entrypoint.
  - _(standard: Node.js ESM Single-Package Architecture — https://nodejs.org/api/packages.html#package-entry-points)_
- D3@1 (implements R3): Align `pwa-nav auth` usage string with strict parser options.
  - Remove `--clean` and `--debug` mentions from `usage()` in `src/cli.ts`.
  - Retain `--port <n>` and `--timeout <ms|s>` which match `strictParse("auth", ...)`.
- D4@1 (implements R4): Module encapsulation in `src/screens/screen-learn.ts`.
  - Remove `export` keyword from `isProse`, `isTransientName`, and `nestBranchIntoActionList`.
  - Keep internal function declarations intact for use in lines 171, 172, 340, 343, 414, 423.
- D5@1 (implements R5): Remove legacy click target syntax.
  - Delete `// legacy support for target="id=value"` parsing block (lines 27-33) in `src/tools/click.ts`.
  - Ensure `parseTarget` in `src/screens/screen-resolve.ts` continues to handle `@id` and plain refs without divergence.
- D6@1 (implements R6): Lazy default filesystem paths in `src/ops/ops.ts`.
  - Replace static `export const DEFAULT_ACTIONS_PATH = join(resolveAgentDir(), "actions.log")` and `DEFAULT_SCREENSHOT_PATH` with `getDefaultActionsPath()` and `getDefaultScreenshotPath()` (or lazy getters).
  - Defer execution of `resolveAgentDir()` until an action actually writes actions or saves a screenshot.
  - _(standard: Node.js I/O Performance Best Practices — https://nodejs.org/api/fs.html#synchronous-api)_
- D7@1 (implements R7): Align test mock signatures with core interfaces.
  - Fix property types and missing fields (`profileDir`, `pid`, `launch`) in:
    - `src/browser/test/app-shortcut.test.ts`
    - `src/browser/test/bidi-backend.test.ts`
    - `src/browser/test/profile-lock.test.ts`
    - `src/browser/test/provisioner.test.ts`
    - `src/ops/test/auth-workflow.test.ts`
    - `src/tools/test/discover.test.ts`
    - `src/tools/test/status.test.ts`
    - `src/tools/test/tools.test.ts`
  - Ensure `npx tsc --noEmit` exits with status 0.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Flatter architecture | Eliminates 5 unneeded intermediate files and layers |
| Fast and zero-I/O module import | Module load requires no synchronous directory traversal |
| Type safety guarantee | Restores `tsc --noEmit` as an authoritative safety net in CI |
| Clear CLI documentation | Eliminates misleading zombie flags |

| Con | Mitigation |
|---|---|
| Potential regression in CLI semantic command invocations | Comprehensive existing test suites in `src/cli/test/` and `src/tools/test/` verify exact CLI behavior |
| Callers using removed `DEFAULT_*_PATH` exports | Audit verified only 2 internal call sites in `ops.ts`, both updated in the same change |

## Deliverables

- `src/cli.ts` (D1, D3)
- `src/tools/click.ts` (D5)
- `src/screens/screen-learn.ts` (D4)
- `src/ops/ops.ts` (D6)
- Test mock repairs across `src/**/test/` (D7)
- Deletion of `cli-screens` and `internal barrel files` (D1, D2)

## Sequencing

1. D4, D5, D6: Pure refactorings on existing modules (tighten encapsulation, drop legacy syntax, lazy I/O).
2. D1, D2: Remove middle-man and orphan barrel files, updating CLI dispatch.
3. D3: Fix CLI help documentation string.
4. D7: Align test mocks to achieve clean `tsc --noEmit`.
