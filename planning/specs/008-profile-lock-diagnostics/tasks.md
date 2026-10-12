# 008 - profile-lock-diagnostics - Tasks

- [ ] T001 [agent] [status:todo] Define ProcessChecker interface and platform aliveness check implementation
      covers: R2@1, D2@1
      changes: src/browser/process-checker.ts (+45 -0)
- [ ] T002 [agent] [status:todo] Implement ProfileLockInspector service for inspecting parent.lock and performing safe stale lock removal
      covers: R1@1, R3@1, D1@1, D3@1
      changes: src/browser/profile-lock.ts (+75 -0)
- [ ] T003 [agent] [status:todo] Integrate lock inspection and stale lock auto-clearing into standalone-runner launcher and instance registry
      covers: R1@1, R3@1, R4@1, D4@1
      changes: src/browser/standalone-runner.ts (+30 -5), src/browser/instance-registry.ts (+20 -3)
- [ ] T004 [agent] [status:todo] Test: Unit test ProcessChecker distinguishes between living and dead process identifiers
      covers: R2@1, D2@1
      kind: test
      changes: src/browser/test/process-checker.test.ts (+40 -0)
- [ ] T005 [agent] [status:todo] Test: Unit test ProfileLockInspector detects holding PIDs, preserves live locks, and clears stale locks
      covers: R1@1, R2@1, R3@1, D1@1, D3@1
      kind: test
      changes: src/browser/test/profile-lock.test.ts (+65 -0)
- [ ] T006 [agent] [status:todo] Test: Integration test standalone launcher auto-recovers from orphaned parent.lock on launch
      covers: R3@1, R4@1, D4@1
      kind: test
      changes: src/browser/test/standalone-runner.test.ts (+45 -0)
- [ ] T007 [human] [status:todo] Verify process kill simulation leaves parent.lock that is cleanly self-healed on next launch
      covers: R3@1, R4@1
