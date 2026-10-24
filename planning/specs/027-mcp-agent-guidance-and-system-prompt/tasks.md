# Tasks: MCP Agent Guidance and System Prompt

- [x] T001 [agent] [status:done] Export buildServerInstructions and update BASE_INSTRUCTIONS in src/mcp/mcp-server.ts with primary browser capability and anti-bot synthetic script warning
      covers: D2@1
      changes: src/mcp/mcp-server.ts (+21 -13)
- [x] T002 [agent] [status:done] Rewrite pwa_open and all tool and parameter descriptions in src/mcp/mcp-tools.ts (and sync docs/mcp.md and SKILL.md) for welcoming general web navigation and direct browser automation
      covers: D1@1, D3@1
      changes: SKILL.md (+1 -1), docs/mcp.md (+3 -4), src/mcp/mcp-tools.ts (+37 -37)
- [x] T003 [agent] [status:done] Unit and integration tests in src/mcp/test/mcp-server.test.ts verifying MCP handshake instructions (authentic browser session and anti-bot warning against Playwright/Selenium/Python)
      covers: R2@1, R3@1
      kind: test
      changes: src/mcp/test/mcp-server.test.ts (+27 -1)
- [x] T004 [agent] [status:done] Unit and integration tests in src/mcp/test/mcp-server.test.ts verifying welcoming pwa_open description and unambiguous browser automation tool and parameter docs
      covers: R1@1, R4@1
      kind: test
      changes: src/mcp/test/mcp-server.test.ts (+37 -1)
