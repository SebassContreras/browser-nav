# Tasks: Assisted Auth Fallback and Reconnection

- [x] T001 [agent] [status:done] Wire AuthWorkflowOrchestrator fallback and clean mode execution into authTool
      covers: D1@1, R1@1
      changes: src/tools/auth.ts (+75 -11)
- [x] T002 [agent] [status:done] Expand CLI cmdAuth and MCP browser_auth with --clean option and schema support
      covers: D2@1, R2@1
      changes: src/cli.ts (+5 -2), src/mcp/mcp-tools.ts (+4 -2)
- [x] T003 [agent] [status:done] Update login barrier hints and documentation across openTool, SKILL.md, README.md, and AGENTS.md
      covers: D3@1, R3@1
      changes: README.md (+1 -1), src/tools/open.ts (+2 -2)
- [x] T004 [agent] [status:done] Unit and integration tests for authTool fallback and clean mode orchestration
      covers: R1@1, R2@1
      kind: test
      changes: src/tools/test/auth-fallback.test.ts (+68 -0)
