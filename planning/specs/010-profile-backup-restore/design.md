# 010 - profile-backup-restore - Design

## Approach

- D1@1 (implements R1, R2): Archive format is gzip-compressed tar (`.tar.gz`), the de-facto standard for directory snapshots. Node has `node:zlib` but no tar, and a hand-written tar writer/reader would be security-sensitive code to maintain, so the `tar` package (node-tar, the implementation npm itself uses) is wrapped in `src/browser/archive.ts`: `packDir(dir, file, filter)` and `unpackFile(file, dir)`. Only this file imports the vendor. Unpack keeps node-tar's safe defaults (no absolute paths, no `..`) and additionally rejects symlink and hardlink entries. _(standard: POSIX ustar/pax - https://pubs.opengroup.org/onlinepubs/9699919799/utilities/pax.html; node-tar - https://github.com/isaacs/node-tar)_
- D2@1 (implements R1): Pure `isVolatileProfilePath(relPath)` in `src/browser/profile-backup.ts` excludes caches and runtime noise: `cache2/`, `startupCache/`, `thumbnails/`, `jumpListCache/`, `shader-cache/`, `crashes/`, `minidumps/`, `datareporting/`, `saved-telemetry-pings/`, `safebrowsing/`, `storage/temporary/`, `*.sqlite-shm`, and the lock files `parent.lock`, `.parentlock`, `lock`. The archive root holds `manifest.json` (`{ format: 1, app, createdAt, firefoxVersion }`, version read from `compatibility.ini`) next to `profile/`.
- D3@1 (implements R1, R2, R3, R4): `backupProfile(app, { out? })` and `restoreProfile(app, file, { force? })` in `src/browser/profile-backup.ts`, composing D1, D2 and spec 008's `inspectProfileLock`.
  - Both refuse with `session_busy` while the profile is `held` (a live Firefox means SQLite files in flux).
  - Backup default destination: `<agentDir>/backups/<app>-<timestamp>.tar.gz` (`.agent/` is git-ignored); explicit `--out` is the user's own choice. File mode `0o600`.
  - Restore extracts into a sibling staging dir, validates (manifest present, `format` known, `manifest.app` equals the target app unless `--force`, `profile/prefs.js` or `profile/times.json` present), then swaps with two renames: current `profile/` → `profile.previous/` (replacing an older one), staging → `profile/`. Any failure removes the staging dir and leaves the current profile untouched.
- D4@1 (implements R1, R2): CLI `pwa-nav profile backup <app> [--out <file>]` and `pwa-nav profile restore <app> <file> [--force]` through `src/tools/profile.ts`, also exported from `src/index.ts` for programmatic use. No MCP tool: restoring replaces the user's signed-in session and stays a human decision.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Move a signed-in session between machines or CI runs without logging in again | |
| Archives are small: caches excluded | |
| Restore is atomic and reversible (`profile.previous/`) | |

| Con | Mitigation |
|---|---|
| The archive is a credential (live cookies) | `0o600`, default under git-ignored `.agent/`, output warns "treat as a password"; no MCP exposure; values never printed |
| New runtime dependency (`tar`) | Single wrapper file; widely used, maintained, safe extraction defaults; can be swapped for another tar library without touching callers |
| Copying a profile while Firefox runs gives torn SQLite files | Refuse while `held` (spec 008) |
| Profile from a newer Firefox can't be opened by an older one | `firefoxVersion` in the manifest; restore warns when it is newer than the local runtime's |
| Malicious archive (path traversal, symlinks, zip bomb) | Safe-path defaults, link entries rejected, extraction into a staging dir that is validated before the swap |
| Some sites bind sessions to IP/device and will sign out anyway | Documented; `pwa-nav status <app>` (spec 007) tells right away |

## Deliverables

- `src/browser/archive.ts` (D1), `src/browser/profile-backup.ts` (D2, D3), `src/tools/profile.ts`, `src/cli.ts` (D4).
- `package.json`: `tar` dependency.
- Tests: `src/browser/test/profile-backup.test.ts` - exclusion filter, round trip, manifest/app mismatch, held profile refused, failed restore keeps the current profile, link entries rejected.
- Docs: `README.md` commands, security note.

## Sequencing

D2 → D1 → D3 → D4. Depends on 008 (`inspectProfileLock`).

## Decisions

- zip rejected: no streaming permissions/mtime story in Node without a dependency either, and tar.gz is what backup tooling on all three OSes reads natively (`tar` ships with Windows 10+).
