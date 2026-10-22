# 022 - audit-cleanup-and-refactor - Requirements

## What's being built

Execution of the read-only audit recommendations: thorough elimination of dead code, unreferenced helpers, orphaned abstractions, and legacy aliases across `src/ops/`, `src/mcp/`, and `src/browser/`; full synchronization of documentation contracts (exit codes, CLI vs MCP execution modes); and stabilization of the test and build safety net.

## Who it serves

Developers, maintainers, and autonomous AI coding agents pair-programming with `pwa-nav`, ensuring an uncluttered, high-cohesion codebase and 100% accurate agent-facing documentation without obsolete or misleading artifacts.

## Requirements

- R1@1: Dead code and unreferenced helpers elimination: Remove unused exports in `src/ops/ops.ts` (`autoCollaborateScreen`, `resolveRef`, `resolveSnapshotId`, `AutoCollaborateResult`), inline trivial single-use path getters (`getDefaultSessionPath`, `getDefaultSnapshotPath`, etc.), and remove orphaned MCP journey tool generators (`buildJourneyTools`, `journeyToolNames`, `MAX_TOOL_NAME`) in `src/mcp/mcp-flows.ts`.
- R2@1: Legacy shims and obsolete test cleanup: Remove unneeded private class exports (`WindowsProcessInspector`, `PosixProcessInspector`) in `src/browser/process-inspector.ts`, remove unreferenced `readFirefoxCompatibilityVersion` in `src/browser/profile-backup.ts`, and eliminate legacy `PWA_NAV_AGENT_DIR` assertions from test fixtures.
- R3@1: Documentation parity and contract synchronization: Update `README.md` to document exit codes 14 (`journey_step_failed`) and 15 (`file_upload_blocked`), remove phantom env var `PWA_NAV_ARMED` from `docs/mcp.md`, correct outdated JSDoc defaults in `src/mcp/mcp-server.ts`, and clarify the intentional operational divergence between CLI (dry-run by default) and MCP (armed by default) in `AGENTS.md`.
- R4@1: Verification and safety net integrity: Ensure all 509 tests pass, TypeScript builds with zero errors, and ESLint produces zero warnings/errors.

## Out of scope

- Modifying public library exports in `src/index.ts`.
- Changing WebDriver BiDi protocol implementations or core security gate invariants (`.agent/kill`).

## Dependencies

- 006 (retire-pwasforfirefox)
- 017 (code-audit-cleanup)
- 019 (smart-url-app-resolution)
- 020 (dynamic-workspace-storage)

## Owner split

Agent: code cleanup, documentation alignment, test updates, verification. Human: review and approval.
