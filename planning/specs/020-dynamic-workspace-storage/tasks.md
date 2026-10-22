- [x] T001 [agent] [status:done] Pure workspace and storage directory resolver
      covers: R4@1, D4@1
      changes: src/core/storage.ts (+87 -13)
- [x] T002 [agent] [status:done] Unit tests for storage resolution and fallback behaviors
      covers: R4@1, D4@1
      kind: test
      changes: src/core/test/storage.test.ts (+68 -1)
- [x] T003 [agent] [status:done] Dynamic config operation and core tool implementation
      covers: R1@1, D1@1
      changes: src/ops/config.ts (+46 -0), src/tools/config.ts (+40 -0)
- [x] T004 [agent] [status:done] Wire pwa_config MCP tool and dynamic context mutation
      covers: R1@1, D1@1
      changes: src/mcp/mcp-tools.ts (+37 -0), src/tools/index.ts (+1 -0)
- [x] T005 [agent] [status:done] Unit and integration tests for pwa_config tool
      covers: R1@1, D1@1
      kind: test
      changes: src/mcp/test/mcp-server.test.ts (+4 -3), src/ops/config.ts (+25 -4), src/tools/test/config.test.ts (+76 -0)
- [x] T006 [agent] [status:done] Per-call workspaceDir and cacheDir parameter resolution across tools
      covers: R2@1, D2@1
      changes: src/mcp/mcp-tools.ts (+1 -0), src/tools/act.ts (+2 -2), src/tools/click.ts (+2 -2), src/tools/common.ts (+20 -7), src/tools/fill.ts (+2 -2), src/tools/open.ts (+5 -5), src/tools/snapshot.ts (+2 -2), src/tools/types.ts (+9 -0)
- [x] T007 [agent] [status:done] Tests for per-call workspace overrides across core tools
      covers: R2@1, D2@1
      kind: test
      changes: src/tools/snapshot.ts (+3 -2), src/tools/test/config.test.ts (+60 -4)
- [x] T008 [agent] [status:done] MCP initialize handshake workspace auto-detection
      covers: R3@1, D3@1
      changes: src/mcp/mcp-server.ts (+39 -0)
- [x] T009 [agent] [status:done] Tests for MCP initialize workspace auto-detection
      covers: R3@1, D3@1
      kind: test
      changes: src/mcp/test/mcp-server.test.ts (+75 -1), src/tools/common.ts (+5 -10)
- [x] T010 [agent] [status:done] Prune obsolete hardcoded storage resolution and update documentation
      covers: R4@1, D4@1
      changes: docs/mcp.md (+1 -0)
- [x] T011 [agent] [status:done] End-to-end integration verification for multi-workspace switching
      covers: R1@1, R2@1, R3@1, R4@1, D1@1, D2@1, D3@1, D4@1
      kind: test
      changes: src/mcp/mcp-tools.ts (+13 -1), src/mcp/test/mcp-workspace.test.ts (+88 -0), src/tools/config.ts (+3 -1)
