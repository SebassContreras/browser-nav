# Investigation & Verification: 2026-10-24 Post-028 Audit

**Date**: 2026-10-24  
**Git HEAD**: `4848934 feat(028): browser-nav canonical tool names, CLI bins, and env vars`  
**Scope**: Code audit verification across `src/**/*.ts`, `package.json`, `docs/`, `SKILL.md`, `AGENTS.md`, and test suites.

---

## Executive Summary

Following the implementation of Spec 028, a full static and runtime audit was conducted across the entire codebase. This document compiles the verified findings, noting exact file and line anchors, verified status, and disposition for subsequent specs (Spec 029 and Spec 030).

---

## Verification Findings Table (F01 – F17)

| ID | Finding Description | Anchors (`file:line`) | Status | Disposition |
|---|---|---|---|---|
| **F01** | Assisted auth subsystem (`AuthWorkflowOrchestrator`, `AuthWatcher`, `ProcessTerminator`, `launchStandaloneAppClean`) has 0 production callers after Spec 021 wired `auth` to `performAuthRelay`. | `src/ops/auth-workflow.ts:41-115`<br>`src/browser/auth-watcher.ts:50-111`<br>`src/browser/process-terminator.ts:54-123`<br>`src/browser/standalone-runner.ts:70-165` | **VERIFIED** | **Deferred to Spec 030** (reconnect `AuthWorkflowOrchestrator` as fallback when cookie relay finds no valid session or on `--clean`). |
| **F02** | CLI bypasses `src/tools/` service layer for 11 commands, and `qaTool` and `journeyTool` in `src/tools/` have 0 production callers. | `src/tools/qa.ts:9-20`<br>`src/tools/journey.ts:13-33`<br>`src/cli.ts:385-971`<br>`src/mcp/mcp-flows.ts:181` | **VERIFIED** | **Included in Spec 029** (unify CLI delegation through `src/tools/`). |
| **F03** | Hollow / ignored options: `CreateBackendOptions.app` is accepted by CLI/MCP `--app` but ignored by `createBackend()`; `cmdDownload` parses `--snapshot` and ignores it; `cmdAuth` passes `--port` to `performAuthRelay` which ignores it. | `src/backend/backend-factory.ts:10,20-36`<br>`src/cli.ts:648,960-971`<br>`src/ops/ops.ts:763-819` | **VERIFIED** | **Included in Spec 029** (connect `--app` in `createBackend()` to `FileInstanceRegistry`; clean up `--snapshot` in `cmdDownload`). |
| **F04** | `downloadTool` bypasses `Backend` abstraction, safety gate (`assertArmedAllowed`), and kill-switch; connects to hardcoded port `9222` in MCP because `baseCtx` omits `port`. | `src/tools/download.ts:98-100`<br>`src/mcp/mcp-server.ts:247-254`<br>`src/cli.ts:645-684` | **VERIFIED** | **Included in Spec 029** (enforce gate/kill-switch, supply real port from context). |
| **F05 / F12** | Scoped pattern targets (`@pattern(query)>@action`) are blocked by `TARGET_PATTERN` in MCP and drop `query` in `resolveTarget` due to a developer `FIXME`. | `src/mcp/mcp-tools.ts:65-71`<br>`src/screens/screen-resolve.ts:238-273`<br>`SKILL.md:102`<br>`docs/screen-map.md:105-116` | **VERIFIED** | **Included in Spec 029** (broaden `TARGET_PATTERN`, resolve `FIXME` with single-depth container matching against `opens` tree, add test). |
| **F06** | Module-level mutable singletons (`memLatestSnapshotId`, `inMemorySession`) ignore `agentDir` and return cached data across workspaces. | `src/core/refs.ts:49-52`<br>`src/backend/backend.ts:112-124` | **VERIFIED** | Noted for caching isolation; addressed during tool context resolution. |
| **F07** | Dead exports and unused methods (`DEFAULT_ACTIONS_PATH`, `DEFAULT_SCREENSHOT_PATH`). | `src/ops/ops.ts:52-53` | **VERIFIED** | Cleaned up during tool consolidation. |
| **F08** | Duplicate logic clusters across modules (`normalizeOrigin`, `FORBIDDEN_FILE_NAMES`, parameterizeRoute). | `src/core/gate.ts`<br>`src/core/download-security.ts`<br>`src/screens/screen-learn.ts` | **VERIFIED** | Standardized. |
| **F09** | Double disk write in `performSnapshot` when `outPath` is default. | `src/ops/ops.ts:283-286` | **VERIFIED** | Addressed. |
| **F10** | 28 TypeScript compiler errors in test files when running `tsc --noEmit -p tsconfig.json`; `package.json` lacks `typecheck` script. | `tsconfig.json`<br>7 test files | **VERIFIED** (exactly 28 errors across 7 test files) | **Included in Spec 029** (add `typecheck` script to `package.json`, fix all 28 type errors in test files without weakening tests). |
| **F11** | `SKILL.md:40` instructs agents to pass `interactiveOnly: true` to `pwa_snapshot`, which fails Ajv strict schema validation (`additionalProperties: false`). | `SKILL.md:40`<br>`src/mcp/mcp-tools.ts:178-196` | **VERIFIED** | **Included in Spec 029** (update `SKILL.md` to reflect valid parameters). |
| **F13** | Contradiction between docs and code on CLI arming default: `SKILL.md` and CLI comments claim armed by default with `[--dry-run]`, but code (`isArmed()`) enforces dry-run by default requiring `--armed`. | `SKILL.md:42-51,127-129`<br>`src/cli.ts:68-78,518,528-533`<br>`AGENTS.md:113`<br>`README.md:155` | **VERIFIED** | **Included in Spec 029** (maintain CLI dry-run by default, fix `SKILL.md` and CLI `--help`). |
| **F14** | Documentation and error hints refer to `auth clean` / `auth debug` / `action: "clean"`, but code only supports cookie relay. | `README.md:256-261`<br>`src/mcp/mcp-tools.ts:545-547`<br>`src/tools/open.ts:71,83`<br>`src/tools/status.ts:30` | **VERIFIED** | **Deferred to Spec 030** (realign docs and tool hints when assisted auth fallback is implemented). |
| **F15** | Stale `pwa_*` nomenclature in docs (`AGENTS.md`, `SKILL.md`, `README.md`, `docs/mcp.md`) despite Spec 028 introducing canonical `browser_*` tools and `BROWSER_NAV_*` env vars. | `AGENTS.md`<br>`SKILL.md`<br>`README.md`<br>`docs/mcp.md`<br>`src/mcp/mcp-tools.ts:154-605` | **VERIFIED** | **Included in Spec 029** (update documentation to canonical `browser_*` and `BROWSER_NAV_*`). |
| **F16** | Storage path doc drift: docs claim `screens/<app>.screens.json` while code stores in `.agent/apps/<appSlug>/screens.json`. | `README.md`<br>`docs/screen-map.md`<br>`docs/mcp.md`<br>`src/mcp/mcp-tools.ts:163` | **VERIFIED** | **Included in Spec 029** (align documentation with canonical per-app storage path). |
| **F17** | Dead reference to `planning/handoff.md` in `AGENTS.md:27`; `extract` CLI mode discrepancy. | `AGENTS.md:27`<br>`README.md:374`<br>`src/cli.ts:787-798` | **VERIFIED** | **Included in Spec 029** (`extract` unified via `extractTool`, doc references cleaned). |
