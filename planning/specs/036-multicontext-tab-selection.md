# 036 — multicontext-tab-selection

## Goal
Support multiple top-level browser contexts (tabs/windows) over WebDriver BiDi: automatically select the active content tab when other tabs are browser internal pages (`about:*`), display available context IDs with their URLs in disambiguation error messages, and expose `contextId` across MCP tools and configuration.

## Requirements
- R1: When multiple top-level contexts exist and no `contextId` is supplied, `withTopLevelContext` automatically selects the single context whose URL is an HTTP or HTTPS web page if all other open contexts are browser internal pages (`about:blank`, `about:home`, `about:welcome`, `about:newtab`). If exactly 1 context exists, it is selected unconditionally. If 0 contexts exist, it throws `no_browser`. If 2+ contexts exist but 0 are HTTP(S) content pages, it throws `invalid_args`. If an explicit `contextId` is provided, auto-selection is bypassed and the specified context is validated directly.
- R2: When multiple HTTP(S) contexts exist and no `contextId` is supplied (or when an unknown `contextId` is provided), `withTopLevelContext` throws `PwaNavError("invalid_args")` with an error message and recovery hint listing all available contexts with their IDs and URLs (e.g. `c1 (https://example.com)` or `c2 (blank)` for empty URLs), indicating how to pass `contextId` via MCP or `--context <id>` via CLI.
- R3: Tools and backend layers accept optional `contextId?: string` across `BackendRequest`, `ToolContext`, `CommonToolOptions`, `getBackend`, and `BackendFactoryRequest` (`src/backend/backend-factory.ts`), resolving precedence as explicit request argument > session default in `ToolContext` > undefined.
- R4: MCP inspection and action tools (`browser_snapshot`, `browser_find`, `browser_click`, `browser_fill`, `browser_act`, `browser_wait`, `browser_extract`, `browser_screenshot`, `browser_upload`) expose `contextId?: string` in their input schemas (`additionalProperties: false`), validate string type, and pass it to backend operations.
- R5: `browser_config` supports inspecting the session's active targeted `contextId` in `action: "get"` and setting or updating the session-default `contextId` in `action: "set"`.

## Design
- D1 (R1): In `src/bidi/session.ts` (`withTopLevelContext`), inspect the URLs of `contexts`. If `contexts.length > 1` and `contextId === undefined`, partition into content contexts (HTTP/HTTPS) and internal contexts (`about:*`). If exactly one content context is open, resolve to its ID instead of throwing. Source: W3C WebDriver BiDi specification (`browsingContext.getTree` and `BrowsingContextInfo`) https://w3c.github.io/webdriver-bidi/#command-browsingContext-getTree (accessed 2026-11-02).
- D2 (R2): In `src/bidi/session.ts`, format disambiguation and unknown context error hints as: `Pass contextId in MCP or --context <id> in CLI. Available: ${contexts.map(c => `${c.context} (${c.url || "blank"})`).join(", ")}`.
- D3 (R3): In `src/tools/types.ts`, add `contextId?: string` to `BackendRequest`, `CommonToolOptions`, and `ToolContext`. Update `getBackend` in `src/tools/common.ts` to pass `contextId: req.contextId ?? ctx.contextId` to `ctx.backendFactory`. In `src/backend/backend-factory.ts`, add `contextId?: string | undefined` to `BackendFactoryRequest` and forward `request.contextId ?? defaults.contextId` in `createBackendFactory`.
- D4 (R4): In `src/mcp/mcp-tools.ts`, add `CONTEXT_ID_PROP = { type: "string", description: "Optional top-level browsing context (tab/window) ID to target." }` to interactive and inspection tools, forwarding `contextId` to tool runners and `getBackend`.
- D5 (R5): In `src/tools/config.ts` and `src/mcp/mcp-tools.ts`, add `contextId` to `browser_config` `get` and `set` actions, mutating `ctx.contextId` on `set` and reporting active `contextId` on `get`.

### Trade-offs & Mitigations
- Auto-selection heuristic vs strict manual selection: Auto-selecting when exactly one HTTP/HTTPS tab exists avoids agent friction when Firefox launches with auxiliary internal tabs (`about:blank`, `about:welcome`). *Mitigation:* Bounded strictly to cases where 1 content tab and only internal `about:*` tabs exist; when multiple content tabs are open, it fails-fast with enriched IDs and URLs to prevent accidental actions on the wrong tab. Explicit `contextId` always overrides the heuristic.
- Session-level default `contextId` vs per-call targeting: Storing `contextId` in `ToolContext` via `browser_config` allows multi-turn conversations to stay focused on a chosen tab without repeating `contextId` in every tool call. *Mitigation:* Explicit `contextId` in individual tool arguments takes precedence over the session default; `browser_config` can inspect or reset `contextId` at any time.

## Tasks
- [x] 036/T001 [agent] Table-driven unit tests in `src/bidi/test/session.test.ts` for `withTopLevelContext` auto-selection across nominal and boundary partitions (single context, 1 content + 1 internal about:blank/about:home, 1 content + N internals, multiple internal only without content throwing invalid_args, explicit contextId bypassing heuristic) — covers R1, D1
      verified: `npx tsx --test src/bidi/test/session.test.ts` passes table-driven auto-selection test suite
- [x] 036/T002 [agent] Table-driven unit tests in `src/bidi/test/session.test.ts` for error message and hint formatting across partitions (multiple content tabs ambiguity, explicit unknown contextId, empty URL fallback to 'blank') asserting PwaNavError invalid_args contract — covers R2, D2
      verified: `npx tsx --test src/bidi/test/session.test.ts` asserts disambiguation hints with ID and URL mappings
- [x] 036/T003 [agent] Update `withTopLevelContext` in `src/bidi/session.ts` with content tab auto-selection heuristic and URL-enriched disambiguation hints — covers R1, R2, D1, D2
      verified: `src/bidi/session.ts` filters content URLs on multiple contexts and enriches error hints with `formatContextItem`
- [x] 036/T004 [agent] Propagate `contextId` through `src/tools/types.ts`, `src/tools/common.ts`, and `src/backend/backend-factory.ts` (`BackendFactoryRequest` and `createBackendFactory`) with request > session precedence — covers R3, D3
      verified: `src/backend/test/backend-factory.test.ts` and `src/tools/test/tools.test.ts` verify request override over session/default contextId
- [x] 036/T005 [agent] Expose `contextId` in `src/mcp/mcp-tools.ts` schemas (with additionalProperties: false) and propagate to tool handlers — covers R4, D4
      verified: `src/mcp/test/mcp-server.test.ts` Ajv2020 validation confirms `contextId` accepted across interactive/inspection tools
- [x] 036/T006 [agent] Implement `contextId` get/set support in `src/tools/config.ts` and `src/mcp/mcp-tools.ts` `browser_config` with unit tests in `src/tools/test/config.test.ts` — covers R5, D5
      verified: `src/tools/test/config.test.ts` verifies `configTool` get and set mutating `ctx.contextId`
- [x] 036/T007 [agent] Table-driven integration tests in `src/mcp/test/mcp-server.test.ts` verifying targeting by `contextId` (explicit argument, session default via `browser_config`, schema validation rejecting invalid types) — covers R4, R5, D4, D5
      verified: `src/mcp/test/mcp-server.test.ts` tests table of tools for string `contextId`, rejection of non-strings, and `browser_config` roundtrip
- [x] 036/T008 [agent] Verify: run `pnpm test` and `pnpm lint` across touched test suites (`src/bidi/test/session.test.ts`, `src/tools/test/config.test.ts`, `src/mcp/test/mcp-server.test.ts`) — covers R1, R2, R3, R4, R5
      verified: `pnpm lint`, `pnpm build`, `pnpm smoke`, and `npx tsx --test` across touched test suites passed with 0 errors

## Changes
- 2026-11-02: Text audit:
  - F1: Added ### Trade-offs & Mitigations under ## Design documenting auto-selection heuristics and session-level configuration (ENG-6).
  - F2: Refined R1, R2, and R5 with systematic input partitions (single, zero, 1 content + internal, multiple content, explicit valid/invalid, empty URL), error contracts, and clarified browser_config session target inspection (TEST-I1, TEST-I2, ENG-1).
  - F3: Expanded D3 and T004 to include src/backend/backend-factory.ts (BackendFactoryRequest, createBackendFactory) ensuring contextId reaches backend instances (ENG-2, ENG-4, ARCH-3).
  - F4: Cited W3C WebDriver BiDi specification for browsingContext.getTree in D1 (ENG-7).
  - F5: Rewrote T001, T002, and T007 to specify table-driven test shape, input partitions, boundaries, and assertions (TEST-I1, TEST-I2, TEST-H2).
  - F6: Added T008 verify task covering pnpm test and pnpm lint across touched test suites (TRACE).
  - F7: Aligned task coverage tags across requirements and designs (covers R#, D#).
