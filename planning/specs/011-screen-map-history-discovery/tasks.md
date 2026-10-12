# 011 - screen-map-history-discovery - Tasks

- [ ] T001 [agent] [status:todo] Define HistoryStoreReader interface and implement SqliteHistoryReader querying places.sqlite in read-only mode filtered by origin
      covers: R1@1, D1@1
      changes: src/browser/history-reader.ts (+75 -0)
- [ ] T002 [agent] [status:todo] Implement discoverCandidateRoutes engine for clustering unmapped URL paths and generating skeletal candidate screens
      covers: R2@1, R3@1, D2@1, D3@1
      changes: src/screens/screen-discover.ts (+85 -0)
- [ ] T003 [agent] [status:todo] Expose route discovery via core tool and CLI subcommand pwa-nav screens discover <app>
      covers: R3@1, R4@1, D3@1, D4@1
      changes: src/tools/discover.ts (+40 -0), src/cli/cli-screens.ts (+30 -2), src/tools/index.ts (+5 -0)
- [ ] T004 [agent] [status:todo] Test: Unit test SqliteHistoryReader queries visited URLs and titles matching domain without mutating places.sqlite
      covers: R1@1, D1@1
      kind: test
      changes: src/browser/test/history-reader.test.ts (+55 -0)
- [ ] T005 [agent] [status:todo] Test: Unit test discoverCandidateRoutes identifies unmapped routes and constructs valid skeletal ScreenMap structures
      covers: R2@1, R3@1, D2@1
      kind: test
      changes: src/screens/test/screen-discover.test.ts (+60 -0)
- [ ] T006 [agent] [status:todo] Test: Integration test CLI screens discover lists candidates in dry-run mode and enriches screens.json when confirmed
      covers: R3@1, R4@1, D3@1, D4@1
      kind: test
      changes: src/cli/test/cli-discover.test.ts (+45 -0)
- [ ] T007 [human] [status:todo] Verify pwa-nav screens discover <app> on a real browsed PWA discovers visited subpages accurately
      covers: R4@1
