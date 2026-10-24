# Requirements: Tool-Layer and Contract Convergence

## Context

Following Spec 028, a code and documentation audit identified several points of divergence and contract drift:
1. The CLI (`src/cli.ts`) bypasses the `src/tools/` service layer for multiple commands, leaving tools like `qaTool` and `journeyTool` orphaned without callers.
2. `downloadTool` bypasses the safety gate and kill-switch, connects to a hardcoded port in MCP because `baseCtx` omits `port`, and `cmdDownload` declares `--snapshot` without using it.
3. In `createBackend()`, the `--app` flag accepted by the CLI and MCP is silently ignored rather than resolving the active app port via `FileInstanceRegistry`.
4. MCP `TARGET_PATTERN` rejects valid dynamic pattern targets (`@pattern(query)>@action`), and `src/screens/screen-resolve.ts` contains an unaddressed `FIXME` that drops `query` during scoped target resolution.
5. `SKILL.md`, CLI `--help`, and other docs contradict the code on CLI arming default (CLI is dry-run by default requiring `--armed`), `pwa_snapshot` parameters (`interactiveOnly` does not exist in schema), and `pwa_*` vs canonical `browser_*` nomenclature.
6. The test suite has 28 TypeScript compiler errors (`tsc --noEmit -p tsconfig.json`), and `package.json` lacks a dedicated `typecheck` script.

## Requirements

- R1@1: `package.json` MUST include a `typecheck` script running `tsc --noEmit -p tsconfig.json`, and all TypeScript type errors across all test files MUST be resolved cleanly without weakening test assertions or contracts.
- R2@1: `createBackend()` in `src/backend/backend-factory.ts` MUST support `options.app` by querying `FileInstanceRegistry` to resolve the running instance port for the specified app slug, with any explicitly provided `options.port` taking precedence.
- R3@1: `downloadTool` MUST enforce the safety gate (`assertArmedAllowed`) and kill switch, MUST receive the actual active port from the MCP context (fixing port 9222 hardcoding in MCP), and `cmdDownload` MUST NOT accept an unused `--snapshot` option.
- R4@1: Dynamic pattern resolution in `src/screens/screen-resolve.ts` MUST resolve single-depth scoped targets (`@pattern(query)>@action`), validating the child action against the pattern's actions or `opens` branch, and MCP `TARGET_PATTERN` in `src/mcp/mcp-tools.ts` MUST accept scoped pattern target syntax.
- R5@1: CLI command handlers in `src/cli.ts` MUST delegate to the unified service layer in `src/tools/` (`snapshotTool`, `clickTool`, `fillTool`, `uploadTool`, `actTool`, `screenshotTool`, `extractTool`, `findTool`, `waitTool`, `journeyTool`, `qaTool`), keeping `src/ops/` as an internal implementation layer.
- R6@1: Documentation (`SKILL.md`, `AGENTS.md`, `README.md`, `docs/mcp.md`, and CLI `--help`) MUST reflect exact code reality: CLI is dry-run by default requiring `--armed`; `browser_snapshot` parameters are accurately listed (no `interactiveOnly`); canonical `browser_*` and `BROWSER_NAV_*` are documented with `pwa_*` backward-compatibility aliases noted; and screen map storage paths point to `.agent/apps/<appSlug>/screens.json`.
