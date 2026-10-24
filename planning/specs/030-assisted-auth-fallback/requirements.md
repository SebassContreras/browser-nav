# Requirements: Assisted Auth Fallback and Reconnection

## Context

Following Spec 021 (which introduced automatic Firefox profile cookie sync via `performAuthRelay`), the original assisted authentication orchestration subsystem introduced in Spec 016 (`AuthWorkflowOrchestrator`, `AuthWatcher`, `ProcessTerminator`, and `launchStandaloneAppClean`) was left orphaned without any callers in production code (Finding F01 in post-028 audit).
When a user has never logged into the target web application (e.g. Google NotebookLM, LinkedIn, or Cloudflare-protected sites) in their default Firefox profile, `performAuthRelay` finds 0 cookies and reports unauthenticated. In this state, automation is completely blocked with no way forward unless assisted clean-window login is executed.
Furthermore, documentation, error hints, and MCP tool descriptions still promised `auth clean`, `auth debug`, or clean launch for interactive login (Finding F14).

Spec 030 reconnects `AuthWorkflowOrchestrator` as an automatic fallback when cookie relay does not find a valid authenticated session, and explicitly supports `--clean` / `action: "clean"` to invoke clean assisted login on demand.

## Requirements

- R1@1: `authTool` in `src/tools/auth.ts` and `cmdAuth` in `src/cli.ts` MUST attempt cookie relay via `performAuthRelay` first. If no session cookies are found (or if `clean: true` / `--clean` is explicitly requested), `authTool` MUST invoke `AuthWorkflowOrchestrator` to launch the standalone browser in clean mode for user login, monitor cookie storage until authenticated, cleanly terminate the clean process, and relaunch in debug mode on the configured port.
- R2@1: `authTool` and `browser_auth` in MCP MUST support `action: "clean"` (or boolean flag `clean`) and configurable `timeoutMs` to trigger assisted login directly, returning structured outcomes indicating whether assisted login succeeded and transitioning the session to authenticated.
- R3@1: Error hints and documentation across `src/tools/open.ts`, `src/mcp/mcp-tools.ts`, `README.md`, `SKILL.md`, and `AGENTS.md` MUST align with the unified assisted authentication interface (`auth <app> [--clean]`, `browser_auth({ app, action: "clean" })`), eliminating stale references to non-existent manual commands (`auth debug`).
