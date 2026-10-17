# 016 - assisted-auth-transition - Design

## Context

When automating login-walled PWAs (like Google NotebookLM), Firefox must boot without `--remote-debugging-port` so anti-bot algorithms (e.g. Google's "This browser or app may not be secure") do not block OAuth credentials.
Previously, this required a high-friction two-phase manual workflow:
1. `pwa_auth clean`: Opens an unmonitored window where the user types credentials.
2. The user must manually find and close the window to release the Windows `parent.lock`.
3. `pwa_auth debug`: Relaunches in debug mode on port 9222.
If the user forgot step 2, step 3 failed with `session_busy`. Spec 016 eliminates this friction by orchestrating clean launch, background session observation, clean process termination, and debug relaunch in one continuous flow.

## Approach

- D1@1 (implements R1, R5): `AuthWatcher` service interface and `DefaultAuthWatcher` implementation in `src/browser/auth-watcher.ts`.
  - Anti-corruption layer over SQLite session polling.
  - Repeatedly reads cookies via `readCookiesFromProfile(profileDir)` (which uses safe `withProfileDb` with WAL copy in temp dir) and evaluates status with pure function `evaluateSessionHealth(cookies, { host, nowMs })`.
  - Configurable `pollIntervalMs` (default 1000ms), `timeoutMs` (default 180000ms), and optional `AbortSignal`.
  - Resolves `true` when verdict is `"authenticated"`, or throws `PwaNavError("timeout", ...)` if timeout expires.
- D2@1 (implements R2): `ProcessTerminator` service interface and `DefaultProcessTerminator` implementation in `src/browser/process-terminator.ts`.
  - Anti-corruption layer over OS process termination and lock release verification.
  - Windows: runs `taskkill /PID <pid>` (graceful request); POSIX: sends `process.kill(pid, "SIGTERM")`.
  - Polls `inspectProfileLock(profileDir)` until lock state is `"free"` (up to 5s). If still held after grace period, issues forced kill (`taskkill /F /PID <pid>` or `SIGKILL`) to guarantee unblocked launch.
- D3@1 (implements R1, R2, R3, R5): `AuthWorkflowOrchestrator` service in `src/ops/auth-workflow.ts`.
  - Composes `launchStandaloneAppClean`, `AuthWatcher`, `ProcessTerminator`, and `launchStandaloneApp`.
  - Coordinates the state machine:
    1. Spawn clean instance via `launchStandaloneAppClean` and capture `pid`.
    2. Watch session health via `AuthWatcher.waitForAuth(...)`.
    3. Terminate clean instance via `ProcessTerminator.terminate(pid, profileDir)`.
    4. Spawn debug instance via `launchStandaloneApp({ url, appSlug, port })`.
- D4@2 (implements R4@2): Simplify `performAuthRelay` (`src/ops/ops.ts`), `authTool` (`src/tools/auth.ts`), `mcp-tools.ts`, and CLI `auth` subcommand (`src/cli.ts`).
  - Removes legacy `clean` and `debug` actions and flags.
  - CLI: `pwa-nav auth <app> [--timeout <seconds>]` executes `AuthWorkflowOrchestrator` directly.
  - MCP: `pwa_auth({ app: "<app>", timeoutMs?: number })` executes the orchestrator directly, keeping only `action: "status"` for read-only cookie health inspection.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Zero manual window closure | The user only signs in; the agent and system handle the rest |
| Eliminates `session_busy` errors | Process terminator explicitly validates `inspectProfileLock` is `"free"` before debug launch |
| Adheres to 8 principles | High cohesion (separate watcher and terminator), small pure interfaces, injectable dependencies |

| Con | Mitigation |
|---|---|
| Window closes and reopens (visual flicker) | Normal and required because Firefox cannot enable BiDi in-place; prompt clearly informs the user |
| Polling disk I/O on `cookies.sqlite` | `withProfileDb` copies only SQLite files to temp dir; 1s interval consumes negligible CPU |
| User closes window before finishing login | Process inspection handles dead PID cleanly and aborts gracefully |

## Deliverables

- `src/browser/auth-watcher.ts` (D1) + tests in `src/browser/test/auth-watcher.test.ts`.
- `src/browser/process-terminator.ts` (D2) + tests in `src/browser/test/process-terminator.test.ts`.
- `src/ops/auth-workflow.ts` (D3) + tests in `src/ops/test/auth-workflow.test.ts`.
- Updates to `src/ops/ops.ts`, `src/tools/auth.ts`, `src/cli.ts` (D4).
- Documentation updates in `docs/mcp.md` and `README.md`.

## Sequencing

D1 and D2 build the isolated service layers. D3 orchestrates them. D4 wires them into CLI and MCP.
