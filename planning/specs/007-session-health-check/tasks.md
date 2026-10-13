# 007 - session-health-check - Tasks

- [x] T001 [agent] [status:done] profile-db adapter: temp copy of db + wal, node:sqlite open, cleanup
      covers: D1@1
      changes: src/browser/profile-db.ts (+37 -0)
- [x] T002 [agent] [status:done] readProfileCookies (moz_cookies names/host/expiry, no values) and evaluateSessionHealth verdicts
      covers: D2@1, D3@1
      changes: src/browser/session-health.ts (+94 -0), src/browser/session-reader.ts (+24 -0)
- [x] T003 [agent] [status:done] statusTool, pwa_auth action "status", CLI `pwa-nav status <app> [--cookie]`
      covers: D4@1
      changes: src/backend/backend.ts (+18 -0), src/browser/profile-db.ts (+1 -1), src/cli.ts (+26 -0), src/mcp/mcp-tools.ts (+20 -6), src/ops/ops.ts (+2 -3), src/tools/index.ts (+1 -0), src/tools/status.ts (+47 -0)
- [ ] T004 [agent] [status:todo] Test: profile-db leaves originals untouched; verdicts (domain match, ms/s expiry, override, missing profile); status tool output
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
- [ ] T005 [human] [status:todo] Verify `pwa-nav status <app>` on a live signed-in and a signed-out profile
      covers: R2@1, R3@1, R4@1
