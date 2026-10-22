# 022 — audit-cleanup-and-refactor — Design

## Approach

- D1@1 (implements R1): Prune dead perform-layer exports and orphaned MCP helpers. Delete `autoCollaborateScreen`, `resolveRef`, `resolveSnapshotId`, and `AutoCollaborateResult` from `src/ops/ops.ts`. Inline single-use path helpers (`getDefaultSessionPath`, `getDefaultSnapshotPath`, `getDefaultActionsPath`, `getDefaultScreenshotPath`) directly into their callers using `resolveAgentDir`. In `src/mcp/mcp-flows.ts`, remove dead journey tool builders (`buildJourneyTools`, `journeyToolNames`, `MAX_TOOL_NAME`) and keep generic flow handling, adhering strictly to KISS/YAGNI (Principle 1) and SRP (Principle 2).
- D2@1 (implements R2): Encapsulate internal browser classes and drop obsolete test shims. Remove `export` from `WindowsProcessInspector` and `PosixProcessInspector` in `src/browser/process-inspector.ts`, exposing only `createProcessInspector` and the `ProcessInspector` interface (Anti-Corruption & Clean Interfaces, Principle 4 & 5). Delete dead function `readFirefoxCompatibilityVersion` from `src/browser/profile-backup.ts`. Remove obsolete `PWA_NAV_AGENT_DIR` assertions from `src/core/test/storage.test.ts`.
- D3@1 (implements R3): Align documentation contracts across human and agent surfaces. Add exit codes 14 and 15 to the `README.md` exit codes table. Purge ghost environment variable `PWA_NAV_ARMED` from `docs/mcp.md`. Correct JSDoc comments in `src/mcp/mcp-server.ts`. Document the intentional distinction between CLI (dry-run by default unless `--armed`) and MCP (armed by default unless `--dry-run`) in `AGENTS.md` (Documentation as a Contract, Principle 10).
- D4@1 (implements R4): Full test and hygiene verification. Ensure all unit and integration test suites pass (509 passing tests), verify `pnpm lint`, `pnpm build`, and `pnpm smoke` run cleanly, ensuring zero regressions (Testing Hygiene, Principles 6, 7 & 8).

## Trade-offs & Mitigations

- **Decision 1: Direct deletion of dead exports vs deprecation notices.**
  - *Pros*: Completely cleans technical debt and eliminates dead code paths in a repository where no downstream users rely on private internal helpers.
  - *Cons*: Any hypothetical internal file importing these would break.
  - *Mitigation*: Knip and AST tracing confirmed zero internal references. `src/index.ts` public exports remain untouched.
- **Decision 2: Inlining single-use path getters in `ops.ts`.**
  - *Pros*: Eliminates 4 redundant wrapper functions and simplifies `ops.ts`.
  - *Cons*: Slight repetition if a second caller needed those specific paths.
  - *Mitigation*: Standard path resolution is already centrally handled by `src/core/storage.ts` (`resolveAgentDir`).
- **Decision 3: Generic `pwa_journey` tool over dynamic MCP journey builders.**
  - *Pros*: Avoids bloat in `tools/list` and simplifies MCP server catalog.
  - *Cons*: Agents must pass journey name as a parameter instead of having dedicated per-journey tool entries.
  - *Mitigation*: Journeys are declarative workflows that naturally accept `{ name, inputs }` via `pwa_act` or journey commands.

## Deliverables

- `src/ops/ops.ts`: Prune dead exports, inline trivial path getters.
- `src/mcp/mcp-flows.ts`: Prune orphaned journey tool builders.
- `src/browser/process-inspector.ts`: Internalize concrete inspector classes.
- `src/browser/profile-backup.ts`: Delete unreferenced `readFirefoxCompatibilityVersion`.
- `src/core/test/storage.test.ts`: Clean obsolete legacy alias tests.
- `README.md`, `docs/mcp.md`, `AGENTS.md`, `src/mcp/mcp-server.ts`: Parity and contract fixes.
- Tests and verification logs.

## Sequencing

1. Prune dead exports and helpers in `src/ops/ops.ts` and `src/mcp/mcp-flows.ts`.
2. Encapsulate browser classes in `src/browser/process-inspector.ts` and clean `src/browser/profile-backup.ts`.
3. Update documentation (`README.md`, `docs/mcp.md`, `AGENTS.md`, `src/mcp/mcp-server.ts`).
4. Run full validation (`pnpm lint && pnpm build && pnpm test && pnpm smoke`).
