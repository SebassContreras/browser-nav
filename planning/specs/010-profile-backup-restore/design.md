# 010 - profile-backup-restore - Design

## Approach

- D1@1 (implements R1, R3): Implement `ProfileArchiver` service (`src/browser/profile-backup.ts`) exposing `backupProfile(appSlug, destinationPath, options)` and `restoreProfile(appSlug, sourcePath, options)` using Node built-in compression (`node:zlib`) and standard tar/zip stream formatting without heavy external dependencies. Excludes volatile paths (`cache2/`, `startupCache/`, `thumbnails/`, `parent.lock`, `jumpListCache/`). _(judgement, no standard)_
- D2@1 (implements R3, R4): Incorporate security boundary and integrity verification checks before archiving or extracting: enforce that destination/source paths reside strictly within permitted workspace boundaries (reusing `src/core/gate.ts` security checks), verify profile signature (`user.js` or `prefs.js` present), and purge stale `parent.lock` during restore. _(judgement, no standard)_
- D3@1 (implements R1, R2): Expose CLI commands `pwa-nav profile backup <app> [--dest <path>]` and `pwa-nav profile restore <app> --from <path>` via `src/cli/cli-profile.ts` and core service layer `src/tools/profile.ts`. _(judgement, no standard)_

## Deliverables

- `src/browser/profile-backup.ts`: `ProfileArchiver` interface and implementation with exclusion filtering and compression (D1, D2).
- `src/tools/profile.ts`: Core tool operations for backup and restore (D3).
- `src/cli/cli-profile.ts`: CLI adapter commands for `pwa-nav profile` (D3).
- Unit tests in `src/browser/test/profile-backup.test.ts` testing exclusion filtering, compression, integrity validation, and path traversal protection.

## Sequencing

1. D1, D2: Profile archiver service with unit tests on compression and exclusions.
2. D3: Core tools and CLI wiring.

## Open questions

None.
