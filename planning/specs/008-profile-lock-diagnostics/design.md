# 008 - profile-lock-diagnostics - Design

## Context

The ambiguous failure this spec targets is concrete: `pwa-nav auth <app>` opens a clean window (no debugging port); if that window is still open when `auth --debug` (or `open --launch`) spawns Firefox again on the same profile, the second process hands the URL to the running instance through Firefox remoting and exits. Port 9222 never opens and the user gets a `no_browser` timeout. A crashed process is the less common case: Firefox itself recovers stale locks (the Windows `parent.lock` handle dies with the process; on POSIX the `fcntl` lock dies and the `lock` symlink's PID is checked). So the main value is fast, precise diagnosis of a *live* holder; stale cleanup is a small, guarded extra.

Lock artifacts per platform (nsProfileLock): Windows `parent.lock` opened without sharing; Linux `.parentlock` (fcntl) + `lock` symlink to `<ip>:+<pid>`; macOS `.parentlock` (fcntl) only.

## Approach

- D1@1 (implements R2, R4): `ProcessInspector` interface in `src/browser/process-inspector.ts`: `isAlive(pid)` (`process.kill(pid, 0)`, `EPERM` = alive) and `findByArg(fragment) → { pid, command }[]`. Two implementations behind it, both built on one injected `runCommand(file, args)` (an `execFile` wrapper): Windows queries `Get-CimInstance Win32_Process -Filter "Name='firefox.exe'"` as JSON through `powershell.exe -NoProfile`; POSIX runs `ps -ax -o pid=,args=`. Two real OS backends justify the interface. _(standard: Node `process.kill(pid, 0)` existence check - https://nodejs.org/api/process.html#processkillpid-signal; Win32_Process - https://learn.microsoft.com/windows/win32/cimwin32prov/win32-process)_
- D2@1 (implements R1, R2): `inspectProfileLock(profileDir, deps) → { state: "free" | "held" | "stale", holders: { pid, command }[] }` in `src/browser/profile-lock.ts`. Steps: (1) no lock artifacts → `free`; (2) Windows: try `fs.open(parent.lock, "r+")` - `EBUSY`/`EPERM` means held; POSIX: read the `lock` symlink PID and check `isAlive`; (3) only when held or undecidable (macOS, PID reuse) list processes whose command line contains the normalised profile path (case-insensitive, `\`/`/` unified on Windows). Holders found → `held`; artifacts but no holder → `stale`. _(standard: Firefox profile lock - https://searchfox.org/mozilla-central/source/toolkit/profile/nsProfileLock.cpp)_
- D3@1 (implements R3): `clearStaleLock(profileDir, deps)` re-runs D2 immediately before deleting and only removes artifacts when the state is still `stale`: the POSIX `lock` symlink, or a Windows `parent.lock` that opens without error. `.parentlock` (fcntl, kernel-released) is never touched. Returns what it removed.
- D4@1 (implements R4): Before spawning in `launchStandaloneApp` and `launchStandaloneAppClean` (`src/browser/standalone-runner.ts`): `held` → throw `PwaNavError("session_busy", "profile <app> is in use by <command> (PID <n>)")` with a hint naming the window to close and the exact OS command (`taskkill /PID <n>` / `kill <n>`) for the user to run; `stale` → `clearStaleLock` then spawn. Nothing is killed automatically. Inspection deps are injectable so tests never touch the real process table.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Turns a 30 s `no_browser` timeout into an instant `session_busy` that names the PID | |
| Happy path costs one `open`/`readlink` syscall | Process listing only runs when a lock is present |

| Con | Mitigation |
|---|---|
| Windows process listing via PowerShell/CIM is slow (~0.5-1.5 s) | Only on the held/undecidable path; 5 s timeout, failure degrades to `held` without PID instead of throwing |
| PID reuse: a dead Firefox PID now belongs to another program | A PID only counts as a holder if its command line contains the profile path |
| Race: two launchers judge the same lock stale (Mozilla bug 541595) | Re-inspect right before unlink; the OS-level lock (handle/fcntl) is authoritative and is never removed |
| Profile path spelled differently in the command line | Normalise both sides (resolve, case-fold and slash-unify on Windows) |
| User expects us to close the window | Out of scope by design; the hint gives the exact command and the user decides |

## Deliverables

- `src/browser/process-inspector.ts` (D1), `src/browser/profile-lock.ts` (D2, D3).
- `src/browser/standalone-runner.ts` (D4).
- Tests: `src/browser/test/profile-lock.test.ts` with fake fs/process deps (free, held with PID, stale cleared, PID reuse ignored, listing failure); runner throws `session_busy` before spawning.
- Docs: `docs/firefox-runtime.md` troubleshooting.

## Sequencing

D1 → D2 → D3 → D4.

## Decisions

- `instance-registry.ts` is not changed: it already prunes entries whose port does not answer.
