# 010 - profile-backup-restore - Tasks

- [ ] T001 [agent] [status:todo] archive.ts wrapper over node-tar (pack with filter, safe unpack rejecting links)
      covers: D1@1
- [ ] T002 [agent] [status:todo] Volatile-path filter, manifest, backupProfile / restoreProfile with lock check and atomic swap
      covers: D2@1, D3@1
- [ ] T003 [agent] [status:todo] CLI `pwa-nav profile backup|restore` and library export
      covers: D4@1
- [ ] T004 [agent] [status:todo] Test: filter, round trip, app mismatch, held refused, failed restore keeps profile, links rejected
      covers: R1@1, R2@1, R3@1, R4@1
      kind: test
- [ ] T005 [human] [status:todo] Back up a signed-in profile, restore on another machine, confirm still signed in
      covers: R1@1, R2@1
