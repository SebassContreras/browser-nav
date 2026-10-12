# 010 - profile-backup-restore - Tasks

- [ ] T001 [agent] [status:todo] Implement ProfileArchiver service with exclusion filters (omitting cache2, startupCache, parent.lock) and compression
      covers: R1@1, D1@1
      changes: src/browser/profile-backup.ts (+95 -0)
- [ ] T002 [agent] [status:todo] Implement profile restore with boundary validation, signature integrity verification, and safe extraction
      covers: R2@1, R3@1, R4@1, D1@1, D2@1
      changes: src/browser/profile-backup.ts (+60 -5)
- [ ] T003 [agent] [status:todo] Implement core profile tool and CLI command pwa-nav profile backup/restore
      covers: R1@1, R2@1, D3@1
      changes: src/tools/profile.ts (+45 -0), src/cli/cli-profile.ts (+40 -0), src/cli.ts (+15 -1)
- [ ] T004 [agent] [status:todo] Test: Unit test ProfileArchiver excludes transient caches and locks during backup
      covers: R1@1, D1@1
      kind: test
      changes: src/browser/test/profile-backup.test.ts (+55 -0)
- [ ] T005 [agent] [status:todo] Test: Unit test restoreProfile rejects path traversal, validates profile signature, and restores files accurately
      covers: R2@1, R3@1, R4@1, D2@1
      kind: test
      changes: src/browser/test/profile-backup.test.ts (+60 -0)
- [ ] T006 [agent] [status:todo] Test: Integration test CLI profile backup and restore commands end-to-end
      covers: R1@1, R2@1, D3@1
      kind: test
      changes: src/cli/test/cli-profile.test.ts (+45 -0)
- [ ] T007 [human] [status:todo] Verify backup archive restores into clean environment and launches authenticated session without re-login
      covers: R1@1, R2@1
