# 036 — multicontext-tab-selection

## Goal
Support multiple top-level browser contexts (tabs/windows) over WebDriver BiDi: automatically select the active content tab when other tabs are browser internal pages (`about:*`), display available context IDs with their URLs in disambiguation error messages, and expose `contextId` across MCP tools and configuration.

## Requirements
- R1: When multiple top-level contexts exist and no `contextId` is supplied, `withTopLevelContext` automatically selects the single context whose URL is an HTTP or HTTPS web page if all other open contexts are browser internal pages (`about:blank`, `about:home`, `about:welcome`, `about:newtab`).
- R2: When multiple HTTP(S) contexts exist and no `contextId` is supplied, the error message lists available contexts with both their IDs and URLs (e.g. `c1 (https://example.com)`), indicating how to pass `contextId` via MCP or `--context` via CLI.
- R3: Tools layer (`src/tools/`) accepts optional `contextId?: string` in `BackendRequest`, `ToolContext`, and `getBackend`.
- R4: MCP tools (`browser_snapshot`, `browser_find`, `browser_click`, `browser_fill`, `browser_act`, `browser_wait`, `browser_extract`, `browser_screenshot`, `browser_upload`) expose `contextId?: string` in their input schemas and pass it to the backend.
- R5: `browser_config` supports inspecting active contexts in `action: "get"` and setting a session-default `contextId` in `action: "set"`.

## Design
- D1 (R1): In `src/bidi/session.ts` (`withTopLevelContext`), inspect the URLs of `contexts`. If `contexts.length > 1` and `contextId === undefined`, partition into content contexts (HTTP/HTTPS) and internal contexts (`about:*`). If exactly one content context is open, resolve to its ID instead of throwing.
- D2 (R2): In `src/bidi/session.ts`, format the `Multiple top-level contexts open` error message as: `Pass contextId in MCP or --context <id> in CLI. Available: ${contexts.map(c => `${c.context} (${c.url || "blank"})`).join(", ")}`.
- D3 (R3): In `src/tools/types.ts`, add `contextId?: string` to `BackendRequest`, `CommonToolOptions`, and `ToolContext`. Update `getBackend` in `src/tools/common.ts` to pass `contextId: req.contextId ?? ctx.contextId` to `ctx.backendFactory`.
- D4 (R4): In `src/mcp/mcp-tools.ts`, add `CONTEXT_ID_PROP = { type: "string", description: "Optional top-level browsing context (tab/window) ID to target." }` to interactive and inspection tools.
- D5 (R5): In `src/tools/config.ts` and `src/mcp/mcp-tools.ts`, add `contextId` to `browser_config` `get` and `set` actions.

## Tasks
- [ ] 036/T001 [agent] Unit test in `src/bidi/test/session.test.ts` for auto-selecting HTTP(S) context when secondary context is about:blank/about:home — covers R1
- [ ] 036/T002 [agent] Unit test in `src/bidi/test/session.test.ts` for error message formatting with context IDs and URLs — covers R2
- [ ] 036/T003 [agent] Update `withTopLevelContext` in `src/bidi/session.ts` with content tab auto-selection and URL-enriched hints — covers D1, D2
- [ ] 036/T004 [agent] Update `src/tools/types.ts` and `src/tools/common.ts` to propagate `contextId` — covers D3
- [ ] 036/T005 [agent] Expose `contextId` in `src/mcp/mcp-tools.ts` schemas and handlers — covers D4
- [ ] 036/T006 [agent] Add `contextId` configuration to `src/tools/config.ts` and `browser_config` — covers D5
- [ ] 036/T007 [agent] Integration tests in `src/mcp/test/mcp-server.test.ts` verifying targeting by `contextId` and session setting via `browser_config` — covers R4, R5
