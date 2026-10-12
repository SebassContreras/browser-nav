# 009 - user-js-performance-tuning - Tasks

- [ ] T001 [agent] [status:todo] Define PERFORMANCE_TUNING_PREFS catalog and implement non-destructive mergeUserJs parser and serializer
      covers: R1@1, R2@1, R3@1, D1@1, D2@1
      changes: src/browser/performance-tuning.ts (+85 -0)
- [ ] T002 [agent] [status:todo] Integrate tuning preferences into ensureStandaloneProfile preserving BiDi flags and user customizations
      covers: R1@1, R4@1, D3@1
      changes: src/browser/standalone-profile.ts (+25 -10)
- [ ] T003 [agent] [status:todo] Test: Unit test mergeUserJs correctly parses user preferences, applies performance flags, and preserves existing custom overrides
      covers: R1@1, R4@1, D1@1, D2@1
      kind: test
      changes: src/browser/test/performance-tuning.test.ts (+60 -0)
- [ ] T004 [agent] [status:todo] Test: Integration test ensureStandaloneProfile writes valid user.js containing BiDi flags, stylesheet flags, and tuning preferences
      covers: R1@1, R2@1, R3@1, D3@1
      kind: test
      changes: src/browser/test/standalone-profile.test.ts (+40 -0)
- [ ] T005 [human] [status:todo] Verify Firefox PWA launches with performance tuning applied without visual defects or script breakages
      covers: R1@1, R2@1
