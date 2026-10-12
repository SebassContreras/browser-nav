# 008 - profile-lock-diagnostics - Design

## Approach

- D1@1 (implements R1, R2): Implement an isolated `ProfileLockInspector` service (`src/browser/profile-lock.ts`) that inspects `parent.lock` in `.agent/apps/<appSlug>/profile/` across platforms (Windows named lock / symlink on POSIX) and extracts or determines the holding process ID. _(standard: Firefox profile lock implementation - https://searchfox.org/mozilla-central/source/toolkit/profile/nsProfileLock.cpp)_
- D2@1 (implements R2, R4): Introduce a platform-agnostic `ProcessChecker` interface (`src/browser/process-checker.ts`) with OS-specific implementations using native Node APIs (`process.kill(pid, 0)`) to distinguish whether the locking process is currently active or dead/orphaned. If active, query commandline/executable to report the exact conflicting PID and binary. _(judgement, no standard)_
- D3@1 (implements R3): Provide `clearStaleLock(profileDir)` that safely removes `parent.lock` only when verified that the holding PID is no longer alive, avoiding data corruption on legitimately active instances while unblocking crashed runs instantly. _(judgement, no standard)_
- D4@1 (implements R1, R3, R4): Wire lock inspection into `standalone-runner.ts` (`launchStandaloneApp`) and `instance-registry.ts` before spawning or reporting connection failures, converting ambiguous exit code 4 / 5 errors into clean diagnostics or self-healed auto-clearing. _(judgement, no standard)_

## Deliverables

- `src/browser/process-checker.ts`: `ProcessChecker` interface and default implementation for process aliveness checks (D2).
- `src/browser/profile-lock.ts`: `inspectProfileLock`, `clearStaleLock`, and diagnostic models (D1, D3).
- Updates to `src/browser/standalone-runner.ts`: Pre-spawn lock verification and stale lock auto-recovery (D4).
- Updates to `src/browser/instance-registry.ts`: Coordination between process checks and instance registry entries (D4).
- Unit and integration tests in `src/browser/test/profile-lock.test.ts`.

## Sequencing

1. D1, D2: ProcessChecker and ProfileLockInspector services with mockable process table tests.
2. D3: Stale lock removal and safety boundary validation.
3. D4: Integration into standalone runner and launcher lifecycle.

## Open questions

None.
