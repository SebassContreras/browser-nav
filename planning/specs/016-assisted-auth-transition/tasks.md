# 016 - assisted-auth-transition - Tasks

- [x] T001 [agent] [status:done] Define AuthWatcher interface and DefaultAuthWatcher implementation with SQLite session polling
      covers: R1@1, R5@1, D1@1
      changes: src/browser/auth-watcher.ts (+111 -0), src/browser/process-terminator.ts (+108 -0), src/browser/test/auth-watcher.test.ts (+108 -0), src/browser/test/process-terminator.test.ts (+107 -0), src/cli.ts (+5 -7), src/mcp/mcp-tools.ts (+10 -3), src/ops/auth-workflow.ts (+115 -0), src/ops/ops.ts (+29 -2), src/ops/test/auth-workflow.test.ts (+105 -0), src/tools/auth.ts (+4 -3)

- [x] T002 [agent] [status:done] Unit test AuthWatcher with fake session readers, verdicts, timeouts, and cancellation
      covers: R1@1, R5@1, D1@1
      kind: test
      changes: none

- [x] T003 [agent] [status:done] Define ProcessTerminator interface and DefaultProcessTerminator with graceful shutdown and lock verification
      covers: R2@1, D2@1
      changes: none

- [x] T004 [agent] [status:done] Unit test ProcessTerminator across graceful exit, force-kill fallback, and lock wait loops
      covers: R2@1, D2@1
      kind: test
      changes: none

- [x] T005 [agent] [status:done] Implement AuthWorkflowOrchestrator coordinating clean launch, watcher, terminator, and debug launch
      covers: R3@1, R5@1, D3@1
      changes: none

- [x] T006 [agent] [status:done] Unit test AuthWorkflowOrchestrator state transitions and failure cleanups
      covers: R3@1, R5@1, D3@1
      kind: test
      changes: none

- [x] T007 [agent] [status:done] Simplify performAuthRelay, authTool, mcp-tools.ts, and CLI auth command to unified auto-auth only
      covers: R4@2, D4@2
      changes: src/cli.ts (+1 -14), src/mcp/mcp-tools.ts (+6 -9), src/ops/ops.ts (+19 -54), src/tools/auth.ts (+1 -3)

- [x] T008 [agent] [status:done] Verify full test suite and smoke test passes (lint, build, test, smoke)
      covers: R1@1, R2@1, R3@1, R4@2, R5@1
      kind: test
      changes: none

- [x] T009 [human] [status:done] Interactive validation with Google NotebookLM: sign in via clean window, verify auto-close and debug relaunch
      covers: R1@1, R2@1, R3@1, R4@2
      changes: src/browser/process-terminator.ts (+16 -1)
