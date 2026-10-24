# Tasks: Dynamic Route Parameterization

- [x] T001 [agent] [status:done] Implement dynamic segment detection and semantic route parameterization in screen-learn.ts
      covers: D1@1, D2@1
      changes: src/screens/screen-learn.ts (+113 -4)
- [x] T002 [agent] [status:done] Unit tests for route parameterization heuristics and semantic parameter naming
      covers: R1@1, R3@1
      kind: test
      changes: src/screens/test/screen-learn.test.ts (+75 -1)
- [x] T003 [agent] [status:done] Update mergeIntoMap in screen-merge.ts to match existing parameterized routes without duplicating screens
      covers: D3@1
      changes: src/screens/screen-merge.ts (+29 -8)
- [x] T004 [agent] [status:done] Unit tests for merging learned screens into existing parameterized screen map entries
      covers: R2@1
      kind: test
      changes: src/screens/test/screen-merge.test.ts (+58 -0)
- [x] T005 [agent] [status:done] Verify and test route matching and compact view resolution for auto-parameterized SPA routes
      covers: D4@1, R4@1
      kind: test
      changes: src/screens/test/screen-match.test.ts (+39 -0)
