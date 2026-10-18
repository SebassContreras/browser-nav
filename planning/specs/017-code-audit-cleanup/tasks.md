# 017 - code-audit-cleanup - Tasks

- [x] T001 [agent] [status:done] Remove export keywords from isProse, isTransientName, and nestBranchIntoActionList in screen-learn.ts
      covers: R4@1, D4@1
      changes: src/screens/screen-learn.ts (+4 -4)

- [x] T002 [agent] [status:done] Verify screen-map tests pass with encapsulated screen-learn helpers
      covers: R4@1, D4@1
      kind: test
      changes: none

- [x] T003 [agent] [status:done] Remove legacy target=id=value parsing branch from src/tools/click.ts
      covers: R5@1, D5@1
      changes: src/tools/click.ts (+1 -9)

- [x] T004 [agent] [status:done] Test clickTool rejects or parses clean targets without legacy branching
      covers: R5@1, D5@1
      kind: test
      changes: none

- [x] T005 [agent] [status:done] Convert DEFAULT_ACTIONS_PATH and DEFAULT_SCREENSHOT_PATH in ops.ts to lazy getters
      covers: R6@1, D6@1
      changes: src/ops/ops.ts (+32 -4)

- [x] T006 [agent] [status:done] Test lazy path getters defer resolveAgentDir evaluation until called
      covers: R6@1, D6@1
      kind: test
      changes: none

- [x] T007 [agent] [status:done] Refactor src/cli.ts to call src/tools directly and delete src/cli/cli-screens.ts
      covers: R1@1, D1@1
      changes: src/cli.ts (+56 -14), src/cli/cli-screens.ts (+0 -85)

- [x] T008 [agent] [status:done] Test CLI commands (click, fill, upload, act, learn, screen) dispatch correctly via tools layer
      covers: R1@1, D1@1
      kind: test
      changes: none

- [x] T009 [agent] [status:done] Delete orphan barrel files src/backend/index.ts, src/core/index.ts, src/ops/index.ts, and src/screens/index.ts
      covers: R2@1, D2@1
      changes: src/backend/index.ts (+0 -2), src/core/index.ts (+0 -5), src/ops/index.ts (+0 -3), src/screens/index.ts (+0 -8)

- [x] T010 [agent] [status:done] Verify imports and single public entrypoint src/index.ts remain valid via knip and test suite
      covers: R2@1, D2@1
      kind: test
      changes: none

- [x] T011 [agent] [status:done] Remove zombie flags --clean and --debug from pwa-nav auth usage help in src/cli.ts
      covers: R3@1, D3@1
      changes: src/cli.ts (+1 -1)

- [x] T012 [agent] [status:done] Test pwa-nav auth usage string matches strictParse options
      covers: R3@1, D3@1
      kind: test
      changes: none

- [x] T013 [agent] [status:done] Fix type mismatches in test mocks across src/browser/test, src/ops/test, and src/tools/test
      covers: R7@1, D7@1
      changes: src/browser/app-shortcut.ts (+1 -1), src/browser/test/app-shortcut.test.ts (+2 -2), src/browser/test/bidi-backend.test.ts (+0 -5), src/browser/test/profile-lock.test.ts (+1 -1), src/browser/test/provisioner.test.ts (+4 -2), src/ops/test/auth-workflow.test.ts (+3 -0), src/tools/test/discover.test.ts (+5 -5), src/tools/test/status.test.ts (+2 -2), src/tools/test/tools.test.ts (+2 -2)

- [x] T014 [agent] [status:done] Verify full typecheck tsc --noEmit and test suite pass with 0 errors
      covers: R7@1, D7@1
      kind: test
      changes: src/ops/ops.ts (+4 -19), src/tools/test/tools.test.ts (+1 -1)
