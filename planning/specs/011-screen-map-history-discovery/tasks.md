# 011 - screen-map-history-discovery - Tasks

- [x] T001 [agent] [status:done] readProfileHistory over withProfileDb (rev_host + exact origin)
      covers: D1@1
      changes: src/browser/history-reader.ts (+66 -0)
- [x] T002 [agent] [status:done] discoverRoutes generalisation/grouping/filtering and applyDiscovery into unmapped[] (schema reason "history")
      covers: D2@1, D3@1
      changes: schemas/screen-map.schema.json (+1 -1), src/screens/screen-discover.ts (+210 -0), src/screens/screen-map.ts (+1 -1)
- [x] T003 [agent] [status:done] discoverTool, CLI `screens discover`, MCP pwa_discover
      covers: D4@1
      changes: src/cli.ts (+44 -1), src/mcp/mcp-tools.ts (+45 -1), src/mcp/test/mcp-server.test.ts (+4 -3), src/tools/discover.ts (+147 -0), src/tools/index.ts (+1 -0)
- [x] T004 [agent] [status:done] Test: reader on fixture places.sqlite; discovery rules; tool dry-run vs write
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
      changes: src/browser/test/history-reader.test.ts (+84 -0), src/screens/test/screen-discover.test.ts (+124 -0), src/tools/test/discover.test.ts (+113 -0)
- [x] T005 [human] [status:done] Run `screens discover` on a real app profile and review candidates
      covers: R2@1, R3@1
      changes: src/browser/test/history-reader.test.ts (+5 -4), src/cli.ts (+3 -0), src/mcp/test/mcp.bidi.stdio.test.ts (+2 -1), src/mcp/test/mcp.stdio.test.ts (+1 -1), src/screens/screen-discover.ts (+2 -2), src/screens/test/screen-discover.test.ts (+17 -13), src/tools/discover.ts (+3 -3), src/tools/test/discover.test.ts (+7 -5)
