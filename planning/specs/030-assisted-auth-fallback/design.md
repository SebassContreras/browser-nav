# 030 — assisted-auth-fallback — Design

## Approach

1. **Fallback Orchestration in `authTool` (Principle 1 & SRP)**:
   In `src/tools/auth.ts`, `authTool` receives `{ app?: string, clean?: boolean, action?: "status" | "clean" | "relay", timeoutMs?: number, port?: number }`.
   - If `action === "status"`: call `statusTool`.
   - If `clean === true` or `action === "clean"`: skip cookie relay and directly execute `AuthWorkflowOrchestrator.execute()`.
   - Otherwise (default flow): run `performAuthRelay`. If `result.status === "authenticated"`, return success immediately. If `result.status === "unauthenticated"`, trigger `AuthWorkflowOrchestrator.execute()` as fallback. If the user completes login or timeout occurs, return the structured outcome.
2. **Dependency Injection & Testability**:
   `AuthWorkflowOrchestrator` accepts pluggable dependencies (`launchCleanFn`, `launchDebugFn`, `watcher`, `terminator`). `authTool` can accept optional orchestrator injection for unit tests without needing physical Firefox windows.
3. **CLI & MCP Surface Alignment**:
   - CLI `pwa-nav auth <app> [--clean] [--timeout <secs>] [--port <port>]`: parses `--clean`, passes `clean: Boolean(values.clean)` and `port: values.port ? Number(values.port) : undefined` to `authTool`.
   - MCP `browser_auth`: accepts `action: "status" | "clean"`, `clean: boolean`, `timeoutMs: number`, and invokes `authTool`.
4. **Documentation & Barrier Hint Cleanup**:
   Update `src/tools/open.ts:71,83` barrier hint to: `"Login barrier detected (e.g. Google accounts login). Run 'browser-nav auth <app>' to perform assisted login, then resume automation."`. Align `README.md`, `SKILL.md`, `AGENTS.md`, and `docs/mcp.md`.

### Decisions

- D1@1 (implements R1): **Auth Tool Fallback Wiring**. Wire `AuthWorkflowOrchestrator` into `src/tools/auth.ts`. When `performAuthRelay` returns `unauthenticated` or when `clean === true`, instantiate and execute `AuthWorkflowOrchestrator` (resolving app slug and target URL via `resolveAppTarget`), cleanly restarting into debug mode upon login.
- D2@1 (implements R2): **CLI and MCP Assisted Auth Expansion**. Expand CLI `cmdAuth` with `--clean` and update MCP `browser_auth` input schema to accept `clean` and `action: ["status", "clean"]`.
- D3@1 (implements R3): **Hint and Documentation Realignment**. Update login barrier messages in `src/tools/open.ts`, `src/tools/status.ts`, `SKILL.md`, `README.md`, and `AGENTS.md` removing `auth clean`/`auth debug` two-step instructions and directing users/agents to `browser_auth` / `pwa-nav auth <app> [--clean]`.

## Deliverables

- `src/tools/auth.ts`: Integrated fallback and `--clean` handling.
- `src/cli.ts`: Updated `cmdAuth` with `--clean` flag and usage text.
- `src/mcp/mcp-tools.ts`: Schema updates for `browser_auth`.
- `src/tools/open.ts`: Realigned barrier message.
- `src/tools/test/auth-fallback.test.ts`: Unit test for fallback and clean mode orchestration.
- `SKILL.md`, `README.md`, `AGENTS.md`: Documentation updates.
