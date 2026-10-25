# Tasks: Backend Factory Honors Dynamic Storage

- [x] T001 [agent] [status:done] Add failing unit tests: factory uses request cacheDir over default; falls back to default when absent
      covers: D1@1, D6@1, R1@1, R4@1, R5@1
      kind: test
      changes: src/backend/test/backend-factory.test.ts (new)

- [x] T002 [agent] [status:done] Implement createBackendFactory(defaults) with BackendDefaults / BackendFactoryRequest in backend-factory.ts
      covers: D1@1, R1@1, R4@1
      changes: src/backend/backend-factory.ts

- [x] T003 [agent] [status:done] Replace the inline backendFactory lambda in mcp.ts with createBackendFactory({ mode, port, app, cacheDir })
      covers: D2@1, R1@1
      changes: src/mcp.ts

- [x] T004 [agent] [status:done] Make cli.ts makeBackend and the bridge/REPL factories forward req.cacheDir/port/app through createBackendFactory (default live.agentDir)
      covers: D3@1, R1@1
      changes: src/cli.ts

- [x] T005 [agent] [status:done] Swap the hand-written factory in mcp-workspace.test.ts for createBackendFactory({ mode: "offline", cacheDir: startDir }); existing assertions unchanged
      covers: D6@1, R2@1, R3@1, R5@1
      kind: test
      changes: src/mcp/test/mcp-workspace.test.ts

- [x] T006 [agent] [status:done] Add failing cases: after browser_config set workspaceDir, open and the snapshot resource use <workspace>/.agent (E2E); a flow_* handler requests the active .agent dir from the factory
      covers: D4@1, D5@1, D6@1, R2@1, R5@1
      kind: test
      changes: src/mcp/test/mcp-workspace.test.ts

- [x] T007 [agent] [status:done] Route flow and journey handlers through getBackend(ctx) instead of ctx.backendFactory({ armed })
      covers: D4@1, R2@1, R3@1
      changes: src/mcp/mcp-flows.ts

- [x] T008 [agent] [status:done] Snapshot resource reads agentPath(screens.cacheDir ?? baseCtx.agentDir) instead of constructing a backend
      covers: D5@1, R2@1
      changes: src/mcp/mcp-server.ts

- [x] T009 [agent] [status:done] Document in docs/mcp.md that browser_config set applies to all tools live; cwd/--cache-dir are only startup defaults
      covers: D2@1, R2@1
      changes: docs/mcp.md

- [x] T010 [agent] [status:done] Run pnpm lint, pnpm build, pnpm test, pnpm smoke; confirm T001/T005/T006 failed before the fix and pass after; 6 pre-existing failures (no_browser elicitation + stdio frames) also fail on clean main and are out of scope
      covers: D6@1, R5@1, R6@1
      kind: test
      changes: none
