# 009 - user-js-performance-tuning - Tasks

- [x] T001 [agent] [status:done] mergeUserJs managed-block merger and serializer
      covers: D2@1
      changes: src/browser/user-js.ts (+96 -0)
- [x] T002 [agent] [status:done] PERFORMANCE_PREFS catalog and ensureStandaloneProfile non-destructive write
      covers: D1@1, D3@1
      changes: src/browser/performance-prefs.ts (+30 -0), src/browser/standalone-profile.ts (+41 -14)
- [x] T003 [agent] [status:done] Test: user lines kept, override wins, BiDi prefs forced, idempotent, legacy file, catalog names, no startup cache prefs
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
      changes: src/browser/test/standalone-profile.test.ts (+38 -2), src/browser/test/user-js.test.ts (+113 -0), src/browser/user-js.ts (+6 -1)
- [ ] T004 [human] [status:todo] Benchmark cold launch + open/snapshot before and after on one app
      covers: R1@1, R2@1
