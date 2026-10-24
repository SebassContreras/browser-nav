# Tasks: Semantic Screen Noise Filtering

- [x] T001 [agent] [status:done] Implement anonymous checkbox, quick-reaction, external content link, and conversation item filters in screen-learn.ts and collector.ts
      covers: D1@1, D2@1, D4@1, D5@1
      changes: src/browser/collector.ts (+1 -1), src/screens/screen-learn.ts (+168 -4)
- [x] T002 [agent] [status:done] Implement scrubMutableBadgeCounts in screen-learn.ts and badge-resilient matching in screen-merge.ts, screen-resolve.ts, and locate.ts
      covers: D3@1
      changes: src/browser/locate.ts (+18 -0), src/screens/screen-learn.ts (+32 -1), src/screens/screen-merge.ts (+31 -2), src/screens/screen-resolve.ts (+13 -0)
- [x] T003 [agent] [status:done] Unit tests for anonymous checkbox and quick-reaction button exclusion during screen learning
      covers: R1@1, R2@1
      kind: test
      changes: src/screens/test/screen-filtering.test.ts (+57 -1)
- [x] T004 [agent] [status:done] Unit tests for mutable badge counter scrubbing, stable semantic IDs, and re-learn merging across count changes
      covers: R3@1
      kind: test
      changes: src/screens/test/screen-filtering.test.ts (+57 -1)
- [x] T005 [agent] [status:done] Unit tests for user-shared external link filtering and informal conversation list item menu exclusion
      covers: R4@1, R5@1
      kind: test
      changes: docs/screen-map.md (+6 -2), src/screens/screen-learn.ts (+1 -1), src/screens/test/screen-filtering.test.ts (+132 -1)
