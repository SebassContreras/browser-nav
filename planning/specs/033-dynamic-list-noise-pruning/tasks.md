# 033 — Dynamic List & Feed Noise Pruning — Tasks

- [x] T001 [agent] [status:done] Implement pure dynamic list item filter predicates in src/screens/screen-filtering.ts
      covers: D1@1, R1@1, R4@1
      changes: src/screens/screen-filtering.ts (+226 -0)

- [x] T002 [agent] [status:done] Integrate dynamic collection detection and pattern generation into src/screens/screen-learn.ts
      covers: D2@1, R2@1
      changes: src/screens/screen-filtering.ts (+24 -1), src/screens/screen-learn.ts (+26 -120)

- [x] T003 [agent] [status:done] Add explicit exemptions for structural query inputs, filter toggles, and pagination in src/screens/screen-filtering.ts
      covers: D3@1, R3@1
      changes: src/screens/screen-filtering.ts (+1 -1)

- [x] T004 [agent] [status:done] Add behavior regression tests in src/screens/test/screen-filtering.test.ts verifying noise exclusion and pattern generation
      covers: D1@1, D2@1, D3@1, R5@1
      kind: test
      changes: src/screens/screen-filtering.ts (+0 -249), src/screens/screen-learn.ts (+235 -23), src/screens/test/screen-filtering.test.ts (+50 -0)
