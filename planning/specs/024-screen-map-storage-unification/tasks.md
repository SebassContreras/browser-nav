# Tasks: Screen Map Storage Unification

- [x] T001 [agent] [status:done] Export resolveAppScreenMapPath and enforce workspace root fallback in resolveAgentDir
      covers: D1@1, D5@1
      changes: src/core/storage.ts (+8 -0)
- [x] T002 [agent] [status:done] Unit tests for storage resolution and canonical screen map paths
      covers: R1@1, R5@1
      kind: test
      changes: src/core/test/storage.test.ts (+6 -0)
- [x] T003 [agent] [status:done] Ensure idempotent www. stripping and hostname normalization in appSlugFromUrl
      covers: D1@1
      changes: src/backend/backend.ts (+7 -2)
- [x] T004 [agent] [status:done] Unit tests for URL and origin slugification uniformity
      covers: R2@1
      kind: test
      changes: src/core/test/app-registry.test.ts (+8 -0)
- [x] T005 [agent] [status:done] Update loadScreenMapsFromDir to deduplicate and migrate legacy screens maps into apps slug
      covers: D2@1
      changes: src/screens/screen-match.ts (+12 -4)
- [x] T006 [agent] [status:done] Unit tests for screen map loader legacy migration and collision prevention
      covers: R3@1
      kind: test
      changes: src/screens/test/screen-match.test.ts (+13 -0)
- [x] T007 [agent] [status:done] Unify learnTool and captureLiveSnapshot persistence to target canonical app screen maps
      covers: D3@1, D4@1
      changes: src/ops/ops.ts (+1 -2), src/tools/learn.ts (+6 -3)
- [x] T008 [agent] [status:done] Integration test for learn tool canonical app persistence and explicit screen-map precedence
      covers: R1@1, R4@1
      kind: test
      changes: src/tools/test/tools.test.ts (+45 -0)
