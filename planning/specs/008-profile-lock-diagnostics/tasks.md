# 008 - profile-lock-diagnostics - Tasks

- [ ] T001 [agent] [status:todo] ProcessInspector interface with Windows (CIM) and POSIX (ps) implementations over an injected command runner
      covers: D1@1
- [ ] T002 [agent] [status:todo] inspectProfileLock and clearStaleLock
      covers: D2@1, D3@1
- [ ] T003 [agent] [status:todo] Pre-spawn check in launchStandaloneApp / launchStandaloneAppClean: session_busy with PID, stale auto-clear
      covers: D4@1
- [ ] T004 [agent] [status:todo] Test: free, held with PID, stale cleared, PID reuse ignored, listing failure, runner refuses before spawn
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
- [ ] T005 [human] [status:todo] Verify `auth --debug` with the clean window still open reports session_busy with the PID
      covers: R4@1
