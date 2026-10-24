# Tasks: Tool-Layer and Contract Convergence

- [x] T001 [agent] [status:done] Add typecheck script to package.json and fix all 28 TypeScript errors across test suites in src/browser/test/, src/core/test/, and src/tools/test/
      covers: D1@1, R1@1
      changes: package.json (+2 -1), src/browser/test/cookie-extractor.test.ts (+8 -6), src/browser/test/cookie-sync.test.ts (+13 -9), src/browser/test/firefox-profile-discovery.test.ts (+14 -8), src/core/test/gate.test.ts (+1 -1), src/core/test/storage.test.ts (+1 -1), src/tools/test/auth-sync.test.ts (+4 -3), src/tools/test/tools.test.ts (+3 -2)
- [x] T002 [agent] [status:done] Implement app instance port lookup in createBackend() from FileInstanceRegistry
      covers: D2@1, R2@1
      changes: src/backend/backend-factory.ts (+22 -1)
- [x] T003 [agent] [status:done] Add safety gate checks in downloadTool, pass active port in MCP baseCtx, and remove unused --snapshot from cmdDownload
      covers: D3@1, R3@1
      changes: src/cli.ts (+0 -1), src/mcp.ts (+1 -0), src/mcp/mcp-server.ts (+3 -0), src/tools/download.ts (+31 -1)
- [x] T004 [agent] [status:done] Implement single-depth scoped pattern target resolution (@pattern(query)>@action) in screen-resolve.ts and expand TARGET_PATTERN in mcp-tools.ts
      covers: D4@1, R4@1
      changes: src/mcp/mcp-tools.ts (+1 -1), src/screens/screen-resolve.ts (+19 -11), src/screens/test/screen-resolve.test.ts (+37 -0)
- [x] T005 [agent] [status:done] Refactor CLI command handlers in src/cli.ts to delegate to src/tools/ service layer
      covers: D5@1, R5@1
      changes: src/cli.ts (+261 -248), src/tools/act.ts (+3 -3), src/tools/click.ts (+1 -1), src/tools/fill.ts (+1 -1), src/tools/snapshot.ts (+14 -5), src/tools/upload.ts (+1 -1)
- [x] T006 [agent] [status:done] Update documentation and CLI help to reflect CLI dry-run default, canonical browser_* tools, and accurate parameters in SKILL.md, README.md, AGENTS.md, and docs/mcp.md
      covers: D6@1, R6@1
      changes: AGENTS.md (+19 -19), README.md (+15 -15), SKILL.md (+33 -35), docs/mcp.md (+35 -35), src/cli.ts (+2 -2)
- [x] T007 [agent] [status:done] Unit and integration tests for app port resolution, download safety gate, scoped pattern target matching, and CLI tools delegation
      covers: R2@1, R3@1, R4@1, R5@1
      kind: test
      changes: src/backend/backend-factory.ts (+6 -3), src/cli.ts (+9 -40), src/core/test/storage.test.ts (+1 -0), src/screens/test/screen-resolve.test.ts (+1 -3), src/tools/act.ts (+1 -1), src/tools/download.ts (+1 -1), src/tools/test/auth-sync.test.ts (+1 -1), src/tools/test/tools.test.ts (+77 -1)
