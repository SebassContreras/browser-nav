- [x] T001 [agent] [status:done] Core navigation target resolution function and canonical aliases
      covers: D1@1
      changes: src/core/target-resolution.ts (+134 -0)
- [x] T002 [agent] [status:done] Unit tests for navigation target resolution
      covers: R1@1, R2@1, R3@1, D1@1
      kind: test
      changes: src/core/test/target-resolution.test.ts (+98 -0)
- [x] T003 [agent] [status:done] Integrate target resolution into openTool and cmdOpen
      covers: D2@1
      changes: src/cli.ts (+18 -4), src/tools/open.ts (+19 -10)
- [x] T004 [agent] [status:done] Update MCP tool schema, descriptions, and agent instructions
      covers: R4@1, D3@1
      changes: AGENTS.md (+1 -1), SKILL.md (+2 -1), src/mcp/mcp-server.ts (+1 -0), src/mcp/mcp-tools.ts (+6 -1)
- [x] T005 [agent] [status:done] Integration tests for smart open resolution and fail-fast behavior
      covers: R1@1, R2@1, R3@1, D2@1
      kind: test
      changes: src/cli.ts (+0 -1), src/core/target-resolution.ts (+1 -1), src/tools/open.ts (+14 -5), src/tools/test/open.test.ts (+76 -0)
