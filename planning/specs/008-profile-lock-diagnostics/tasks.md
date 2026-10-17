# 008 - profile-lock-diagnostics - Tasks

- [x] T001 [agent] [status:done] ProcessInspector interface with Windows (CIM) and POSIX (ps) implementations over an injected command runner
      covers: D1@1
      changes: src/browser/process-inspector.ts (+164 -0)
- [x] T002 [agent] [status:done] inspectProfileLock and clearStaleLock
      covers: D2@1, D3@1
      changes: src/browser/profile-lock.ts (+183 -0)
- [x] T003 [agent] [status:done] Pre-spawn check in launchStandaloneApp / launchStandaloneAppClean: session_busy with PID, stale auto-clear
      covers: D4@1
      changes: src/browser/standalone-runner.ts (+40 -2)
- [x] T004 [agent] [status:done] Test: free, held with PID, stale cleared, PID reuse ignored, listing failure, runner refuses before spawn
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
      changes: src/browser/profile-lock.ts (+16 -12), src/browser/test/profile-lock.test.ts (+234 -0)
- [x] T005 [human] [status:done] Verify `auth --debug` with the clean window still open reports session_busy with the PID
      covers: R4@1
      changes: none
