# 035 — mcp-schema-consistency

## Goal
Fix schema definition discrepancies in the Model Context Protocol (MCP) server for `browser_auth`, `browser_snapshot`, and `screen_learn`, ensuring tool inputs pass MCP schema validation, and ensure auth unit tests run deterministically without timeout hangs.

## Requirements
- R1: `browser_auth` input schema accepts `{ action: "clean" }` and `{ clean: true }` without failing JSON schema validation.
- R2: Calling `browser_snapshot({ learn: true })` or `screen_learn` without passing `locale` defaults cleanly to `"es"` instead of failing with `invalid_args`.
- R3: The unit test `src/tools/test/auth-sync.test.ts` executes deterministically and finishes within milliseconds even in clean test environments without active session cookies.

## Design
- D1 (R1): In `src/mcp/mcp-tools.ts`, update `authToolDef.inputSchema` to include `"clean"` in `properties.action.enum` (`["status", "clean"]`) and declare optional property `clean: { type: "boolean", description: "Launch clean profile for manual login (alias for action: 'clean')." }`.
- D2 (R2): In `src/tools/snapshot.ts`, pass `locale: locale ?? "es"` when delegating to `learnTool` during `learn: true`. In `src/mcp/mcp-tools.ts`, explicitly document `default: "es"` in `snapshot.inputSchema` and `learnToolDef.inputSchema`.
- D3 (R3): In `src/tools/test/auth-sync.test.ts`, provide a mock `deps.orchestrator` in `authTool({ app: "linkedin" }, { mode: "bidi" }, mockDeps)` so that unauthenticated test cases do not fall back to spawning Firefox and waiting for 180 seconds.

## Tasks
- [ ] 035/T001 [agent] Regression test for `browser_auth` schema validation accepting action clean and flag clean — covers R1
- [ ] 035/T002 [agent] Update `browser_auth` input schema in `src/mcp/mcp-tools.ts` — covers D1
- [ ] 035/T003 [agent] Regression test for `browser_snapshot({ learn: true })` defaulting locale to "es" — covers R2
- [ ] 035/T004 [agent] Apply default locale "es" in `src/tools/snapshot.ts` and update MCP schemas — covers D2
- [ ] 035/T005 [agent] Inject mock orchestrator in `src/tools/test/auth-sync.test.ts` to guarantee test isolation — covers R3, D3
