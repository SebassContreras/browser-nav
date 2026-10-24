# Tasks: Browser-Nav Canonical Renaming

- [x] T001 [agent] [status:done] Implement BROWSER_NAV_* env var resolution with PWA_NAV_* fallback, ~/.browser-nav global directory preference with ~/.pwa-nav fallback, and browser-nav/bnav bins in package.json
      covers: D3@1, D4@1, D5@1
      changes: package.json (+3 -0), src/cli.ts (+17 -10), src/core/gate.ts (+4 -2), src/core/storage.ts (+49 -13), src/core/test/storage.test.ts (+2 -2), src/mcp.ts (+10 -6)
- [x] T002 [agent] [status:done] Rename MCP tools in src/mcp/mcp-tools.ts to canonical browser_* and screen_learn names, add LEGACY_TOOL_ALIASES routing in src/mcp/mcp-server.ts, and update docs
      covers: D1@1, D2@1
      changes: README.md (+13 -13), SKILL.md (+2 -2), docs/mcp.md (+18 -16), src/mcp/mcp-server.ts (+18 -17), src/mcp/mcp-tools.ts (+53 -24)
- [x] T003 [agent] [status:done] Unit and integration tests in src/mcp/test/ verifying canonical browser_* and screen_learn tool manifest and transparent pwa_* alias execution
      covers: R1@1, R2@1
      kind: test
      changes: src/mcp/test/mcp-download.test.ts (+4 -4), src/mcp/test/mcp-server.test.ts (+112 -34), src/mcp/test/mcp.bidi.stdio.test.ts (+16 -16)
- [x] T004 [agent] [status:done] Unit and integration tests in src/core/test/ and src/cli/test/ verifying package.json CLI bins, BROWSER_NAV_* env var precedence and fallback, and ~/.browser-nav global directory resolution
      covers: R3@1, R4@1, R5@1
      kind: test
      changes: src/cli/test/cli.test.ts (+35 -0), src/core/test/gate.test.ts (+6 -1), src/core/test/storage.test.ts (+51 -0)
