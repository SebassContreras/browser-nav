# 007 - session-health-check - Tasks

- [ ] T001 [agent] [status:todo] Define SessionStoreReader interface and implement SqliteSessionReader querying cookies.sqlite and webappsstore.sqlite in read-only mode
      covers: R1@1, D1@1
      changes: src/browser/session-reader.ts (+80 -0)
- [ ] T002 [agent] [status:todo] Implement evaluateSessionHealth domain logic to compute session cookie TTL and produce health verdicts
      covers: R2@1, D2@1
      changes: src/browser/session-health.ts (+65 -0)
- [ ] T003 [agent] [status:todo] Integrate session health checking into auth tool and CLI status command
      covers: R3@1, R4@1, D3@1, D4@1
      changes: src/tools/auth.ts (+25 -2), src/tools/status.ts (+35 -0), src/cli.ts (+15 -1), src/mcp/mcp-server.ts (+10 -2)
- [ ] T004 [agent] [status:todo] Test: Unit test SqliteSessionReader reads cookies in read-only mode without mutating or locking the database
      covers: R1@1, D1@1
      kind: test
      changes: src/browser/test/session-reader.test.ts (+55 -0)
- [ ] T005 [agent] [status:todo] Test: Unit test evaluateSessionHealth evaluates cookie expiration, remaining TTL, and missing profiles
      covers: R2@1, D2@1
      kind: test
      changes: src/browser/test/session-health.test.ts (+60 -0)
- [ ] T006 [agent] [status:todo] Test: Integration test statusTool and pwa_auth({ action: "status" }) return structured verdicts and guidance
      covers: R3@1, R4@1, D3@1
      kind: test
      changes: src/tools/test/status.test.ts (+45 -0)
- [ ] T007 [human] [status:todo] Verify pwa-nav status <app> returns accurate authenticated/expired status on a live standalone app profile
      covers: R3@1, R4@1
