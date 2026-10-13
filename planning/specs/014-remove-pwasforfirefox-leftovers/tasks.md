# 014 - remove-pwasforfirefox-leftovers - Tasks

- [x] T001 [agent] [status:done] Remove `--pwa` from standalone/clean launch args and shortcut args; reuse the launch-args builder in the provisioner
      covers: D1@1
      changes: src/browser/standalone-runner.ts, src/browser/provisioner.ts
- [x] T002 [human] [status:done] Resolve Q1: choose the default Firefox binary once PWAsForFirefox paths are dropped
      covers: D2@1
- [x] T003 [agent] [status:done] Replace firefoxPwaDir/runtimePath with resolveFirefoxBinary (stock Firefox, PWA_NAV_FIREFOX_BINARY override), remove LEGACY_DIR_ENV
      covers: D2@1
      changes: src/browser/pwa-runtime.ts, src/browser/bidi-backend.ts, src/browser/provisioner.ts, src/browser/standalone-runner.ts
- [x] T004 [agent] [status:done] Remove `--pwa` and PWAsForFirefox wording from hints and error messages
      covers: D3@1
      changes: src/browser/pwa-runtime.ts
- [x] T005 [agent] [status:done] Test: launch args, shortcut args and runtime paths contain no `--pwa` or FirefoxPWA paths
      covers: R1@1, R3@1, R4@1, D5@1
      kind: test
      changes: src/browser/test/standalone-runner.test.ts, src/browser/test/provisioner.test.ts, src/browser/test/pwa-runtime.test.ts, src/browser/test/bidi-backend.test.ts, src/browser/test/multi-pwa.test.ts, src/browser/test/standalone-profile.test.ts
- [x] T006 [agent] [status:done] Update docs to the launch without `--pwa` and without PWAsForFirefox paths
      covers: R5@1, D4@1
      changes: docs/firefox-runtime.md (renamed from docs/firefox-pwa.md), docs/notebook-pilot.md, README.md, SKILL.md, AGENTS.md, docs/mcp.md
- [ ] T007 [human] [status:todo] Verify shortcut and `open --launch` start without the PWAsForFirefox error, with app icon and native window controls
      covers: R2@1, R6@1
