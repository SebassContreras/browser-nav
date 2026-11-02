# 035 — mcp-schema-consistency

## Goal
Fix schema definition discrepancies in the Model Context Protocol (MCP) server for `browser_auth`, `browser_snapshot`, and `screen_learn`, ensuring tool inputs pass MCP schema validation, and ensure auth unit tests run deterministically without timeout hangs.

## Requirements
- R1: `browser_auth` input schema accepts all valid parameter combinations (nominal empty `{}` defaulting to clean assisted auth, `{ action: "clean" }`, `{ clean: true }`, `{ action: "status" }`, and valid `{ app, timeoutMs }`), while rejecting invalid action enums, malformed flag types, and unrecognized additional properties (`additionalProperties: false`).
- R2: Calling `browser_snapshot({ learn: true })` or `screen_learn` without passing `locale` defaults cleanly to `"es"`; explicit valid BCP 47 locale tags (e.g. `"en"`) are preserved, and invalid locale strings continue to fail with `invalid_args`.
- R3: The unit test `src/tools/test/auth-sync.test.ts` adheres to the determinism and isolation invariants (TEST-H4, TEST-H5), executing within milliseconds in unauthenticated environments without active cookies by mocking the orchestrator boundary and avoiding browser spawns.

## Design
- D1 (R1): In `src/mcp/mcp-tools.ts`, update `authToolDef.inputSchema` to include `"clean"` in `properties.action.enum` (`["status", "clean"]`) and declare optional property `clean: { type: "boolean", description: "Launch clean profile for manual login (alias for action: 'clean')." }`.
- D2 (R2): In `src/tools/snapshot.ts`, pass `locale: locale ?? "es"` when delegating to `learnTool` during `learn: true`. In `src/mcp/mcp-tools.ts`, declare `default: "es"` in the `locale` property definition across `snapshot.inputSchema` and `learnToolDef.inputSchema`.
- D3 (R3): In `src/tools/test/auth-sync.test.ts`, provide a mock `deps.orchestrator` to `authTool({ app: "linkedin" }, { mode: "bidi" }, mockDeps)` so unauthenticated test cases resolve immediately without spawning Firefox or waiting on timeouts.

### Trade-offs & Mitigations
- Defaulting `locale` to `"es"` in `snapshotTool` aligns with the MCP server default, but assumes Spanish for new screen maps when unspecified. *Mitigation:* Explicit BCP 47 tags passed by callers (e.g. `locale: "en"`) take precedence; schema and docs clearly indicate `"default": "es"`.
- Mocking `deps.orchestrator` in `auth-sync.test.ts` isolates unit tests from real browser launches. *Mitigation:* Opt-in E2E tests (`src/test/e2e.test.ts`) verify end-to-end browser launch behavior, preserving fast deterministic local test runs.

## Tasks
- [x] 035/T001 [agent] Table-driven regression tests in `src/mcp/test/mcp-server.test.ts` for `browser_auth` input schema validating nominal partitions (`action: "clean"`, `clean: true`, `action: "status"`, `{}`), malformed inputs, and rejected additional properties — covers R1, D1
      verified: `npx tsx --test src/mcp/test/mcp-server.test.ts` passes table-driven Ajv2020 validation across all input partitions
- [x] 035/T002 [agent] Update `browser_auth` input schema in `src/mcp/mcp-tools.ts` to accept `action: "clean"` and `clean: boolean` — covers R1, D1
      verified: `browser_auth` schema in `src/mcp/mcp-tools.ts` declares action enum ["status", "clean"] and optional clean boolean
- [x] 035/T003 [agent] Table-driven regression tests in `src/tools/test/tools.test.ts` and `src/mcp/test/mcp-server.test.ts` verifying `browser_snapshot({ learn: true })` and `screen_learn` input partitions (defaulting missing locale to `"es"`, preserving explicit `"en"`, rejecting invalid tags) — covers R2, D2
      verified: `src/tools/test/tools.test.ts` and `src/mcp/test/mcp-server.test.ts` pass locale defaulting, explicit locale preservation, and invalid BCP 47 rejection
- [x] 035/T004 [agent] Apply default locale "es" in `src/tools/snapshot.ts` and add `"default": "es"` schema property in `src/mcp/mcp-tools.ts` — covers R2, D2
      verified: `src/tools/snapshot.ts` defaults locale to "es" on delegation to learnTool; `src/mcp/mcp-tools.ts` declares default: "es" for locale in snapshot and learn schemas
- [x] 035/T005 [agent] Inject mock orchestrator in `src/tools/test/auth-sync.test.ts` for the unauthenticated equivalence class to guarantee deterministic execution without Firefox spawns — covers R3, D3
      verified: `src/tools/test/auth-sync.test.ts` completes in ~42ms deterministically with mock orchestrator boundary injected
- [x] 035/T006 [agent] Verify: run `pnpm test` and `pnpm lint` across touched test suites (`src/mcp/test/mcp-server.test.ts`, `src/tools/test/auth-sync.test.ts`, `src/tools/test/tools.test.ts`) — covers R1, R2, R3
      verified: `pnpm lint` passed with 0 errors; tests across touched suites passed 46/46 tests successfully

## Changes
- 2026-11-02: Audit refined R1-R3 with systematic input partitions and determinism invariants, added D2 schema default property, and added Trade-offs & Mitigations (F1-F6).
