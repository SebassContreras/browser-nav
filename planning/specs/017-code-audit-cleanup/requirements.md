# 017 - code-audit-cleanup - Requirements

## Context & Audit Baseline

This specification addresses the findings from the comprehensive read-only code audit conducted across the `pwa-nav` codebase. The audit identified dead code, redundant middle-man adapters, unparsed/zombie CLI flags, non-lazy top-level I/O, test mock typing drift, and loose encapsulation.

Owner architectural decisions incorporated:
1. Dead submodule barrel files (`backend/index`, `core/index`, `ops/index`, `screens/index`) must be removed; `pwa-nav` is a single-package library with `src/index.ts` as the sole public API surface.
2. Legacy `target="id=value"` in `src/tools/click.ts` is confirmed unused by callers and verified across fixtures/docs/tests before complete removal.
3. The Middle Man adapter `cli-screens` must be eliminated in favor of direct calls from `src/cli.ts` to `src/tools/`.
4. Zombie CLI flags `--clean` and `--debug` in `pwa-nav auth` usage string must be removed from help documentation.
5. Top-level sync filesystem lookups in `src/ops/ops.ts` (`DEFAULT_ACTIONS_PATH`, `DEFAULT_SCREENSHOT_PATH`) must become lazy getters.
6. Test mock interface signatures must be aligned with real types so `tsc --noEmit` exits with 0 errors.
7. Helper functions in `src/screens/screen-learn.ts` (`isProse`, `isTransientName`, `nestBranchIntoActionList`) must be unexported (private to module) rather than deleted.

## What's being built

A comprehensive refactoring and hygiene cleanup pass that eliminates dead barrel files and unused wrappers, removes deprecated syntax, tightens internal module encapsulation, converts top-level startup I/O to lazy evaluation, fixes CLI help string drift, and repairs test mock types to achieve a clean `tsc --noEmit` typecheck without breaking any existing runtime functionality or tests.

## Who it serves

Developers and autonomous pair-programming agents maintaining and extending `pwa-nav`, providing a cleaner codebase, faster module loading, reliable strict typechecking, and zero misleading CLI options or orphan files.

## Requirements

- R1@1: Remove Middle Man adapter: delete `cli-screens` and dispatch semantic actions (`click`, `fill`, `upload`, `act`, `learn`, `screen`) directly from `src/cli.ts` to the unified tools service layer (`src/tools/`).
- R2@1: Remove orphan internal barrel files: delete `backend/index`, `core/index`, `ops/index`, and `screens/index` to enforce explicit internal imports and single-package library entrypoint via `src/index.ts`.
- R3@1: Remove zombie CLI auth flags: eliminate `--clean` and `--debug` from the `pwa-nav auth` usage help string in `src/cli.ts` so documented CLI flags strictly match parsed arguments.
- R4@1: Module encapsulation: unexport `isProse`, `isTransientName`, and `nestBranchIntoActionList` in `src/screens/screen-learn.ts`, keeping their logic private to the module without deleting them.
- R5@1: Remove legacy click syntax: verify no consumers exist across tests, fixtures, docs, and screen maps, then remove the deprecated `target="id=value"` parsing branch from `src/tools/click.ts`.
- R6@1: Lazy default file paths: convert `DEFAULT_ACTIONS_PATH` and `DEFAULT_SCREENSHOT_PATH` in `src/ops/ops.ts` into lazy getter functions to avoid synchronous filesystem traversal (`existsSync`) at top-level module evaluation.
- R7@1: Strict test typecheck: align mock signatures and test fixture types in `src/**/test/*.test.ts` with domain interfaces so `npx tsc --noEmit` passes with 0 errors across the entire codebase.

## Out of scope

- Modifications or audits to the 14 MCP tools in `src/mcp/mcp-tools.ts`: all 14 tools are verified active, tested, fully implemented, and schema-validated.
- Exposing internal submodules as independent published packages (`@pwa-nav/core`, `@pwa-nav/screens`).
- Behavioral changes to BiDi protocol handling or browser automation logic.

## Dependencies

- 006 (retire-pwasforfirefox)
- 012 (native-app-window-chrome)
- 016 (assisted-auth-transition)

## Owner split

Agent: audit verification, barrel removal, CLI direct dispatch refactoring, unexporting module helpers, lazy I/O refactoring, test mock fixes, and verifying `npm run test` + `npx tsc --noEmit`. Human: none required (fully automated checkable tasks).
