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
- [x] T004 [agent] [status:done] Test: profile-db leaves originals untouched; verdicts (domain match, ms/s expiry, override, missing profile); status tool output
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
      changes: src/browser/test/session-health.test.ts (+99 -0), src/tools/test/status.test.ts (+32 -0)
- [x] T005 [human] [status:done] Verify `pwa-nav status <app>` on a live signed-in and a signed-out profile
      covers: R2@1, R3@1, R4@1
      changes: none
- [x] T006 [agent] [status:done] profile-db: retry a failed copy+open once, then throw a structured `PwaNavError` (hint: retry / close the app window) instead of a raw SQLite error (design Con 2 mitigation)
      covers: D1@1
      changes: src/browser/profile-db.ts (+19 -1)
- [x] T007 [agent] [status:done] Raise `package.json` `engines.node` to `>=22.13` so `node:sqlite` is available unflagged (design Con 1 mitigation)
      covers: D1@1
      changes: package.json (+1 -1)
- [x] T008 [agent] [status:done] Add `tldts` and `src/browser/site.ts` (`siteOf(host)`); replace `domainMatches` in session-health with same-site matching
      covers: D2@2
      retires: T002
      changes: package.json (+2 -1), pnpm-lock.yaml (+11 -8), src/browser/session-health.ts (+4 -9), src/browser/site.ts (+9 -0), src/browser/test/session-health.test.ts (+1 -9)
- [x] T009 [agent] [status:done] Widen the auth-cookie name heuristic with `_at$`
      covers: D2@2
      changes: src/browser/session-health.ts (+1 -1)
- [x] T010 [agent] [status:done] Test: same-site matching (`.www.linkedin.com` vs `linkedin.com`, `co.uk`, `github.io`) and `li_at` detected by the heuristic
      covers: D2@2
      kind: test
      changes: src/browser/test/session-health.test.ts (+26 -8)
- [x] T011 [human] [status:done] Re-run `pwa-nav status linkedin.com` on the signed-in profile (expect `authenticated`) and on a signed-out one
      covers: D2@2
      changes: none
