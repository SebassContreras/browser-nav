# 010 - profile-backup-restore - Tasks

- [x] T001 [agent] [status:done] archive.ts wrapper over node-tar (pack with filter, safe unpack rejecting links)
      covers: D1@1
      changes: package.json (+1 -0), pnpm-lock.yaml (+49 -0), src/browser/archive.ts (+63 -0)
- [x] T002 [agent] [status:done] Volatile-path filter, manifest, backupProfile / restoreProfile with lock check and atomic swap
      covers: D2@1, D3@1
      changes: src/browser/profile-backup.ts (+373 -0)
- [x] T003 [agent] [status:done] CLI `pwa-nav profile backup|restore` and library export
      covers: D4@1
      changes: src/cli.ts (+55 -0), src/tools/index.ts (+1 -0), src/tools/profile.ts (+94 -0)
- [x] T004 [agent] [status:done] Test: filter, round trip, app mismatch, held refused, failed restore keeps profile, links rejected
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
      changes: src/browser/archive.ts (+23 -12), src/browser/test/profile-backup.test.ts (+306 -0)
- [x] T005 [human] [status:done] Back up a signed-in profile, restore on another machine, confirm still signed in
      covers: R1@1, R2@1
      changes: none
