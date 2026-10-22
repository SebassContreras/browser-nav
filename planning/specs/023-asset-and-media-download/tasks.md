# 023 — asset-and-media-download — Tasks

- [x] T001 [agent] [status:done] Implement download security path validator and unit tests
      covers: R1@1, R5@1, D1@1
      changes: src/core/download-security.ts (+95 -0), src/core/test/download-security.test.ts (+64 -0)
- [x] T002 [agent] [status:done] Implement DOM asset and inline SVG extractor helper
      covers: R2@1, R3@1, R4@1, D2@1
      changes: src/browser/dom-asset-extractor.ts (+113 -0), src/browser/test/dom-asset-extractor.test.ts (+62 -0)
- [x] T003 [agent] [status:done] Implement performDownload tool service with stream/fetch handling
      covers: R1@1, R2@1, R3@1, R4@1, R6@1, D1@1, D2@1
      changes: src/tools/download.ts (+142 -0), src/tools/test/download.test.ts (+47 -0)
- [x] T004 [agent] [status:done] Expose download command in CLI and pwa_download tool in MCP
      covers: R6@1, R7@1, D3@1
      changes: src/cli.ts (+46 -0), src/mcp/mcp-tools.ts (+35 -0), src/mcp/test/mcp-download.test.ts (+36 -0), src/tools/index.ts (+1 -0)
- [x] T005 [agent] [status:done] Update documentation and run full validation
      covers: R7@1, D3@1
      kind: test
      changes: AGENTS.md (+1 -0), README.md (+1 -0), SKILL.md (+1 -0), src/browser/dom-asset-extractor.ts (+2 -2), src/browser/test/dom-asset-extractor.test.ts (+29 -17), src/cli.ts (+1 -1), src/core/download-security.ts (+1 -1), src/mcp/test/mcp-download.test.ts (+6 -3), src/mcp/test/mcp-server.test.ts (+4 -3), src/mcp/test/mcp.bidi.stdio.test.ts (+2 -1), src/mcp/test/mcp.stdio.test.ts (+1 -1), src/tools/download.ts (+14 -14), src/tools/test/download.test.ts (+2 -1)
