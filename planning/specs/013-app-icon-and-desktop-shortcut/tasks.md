# 013 - app-icon-and-desktop-shortcut - Tasks

- [x] T001 [agent] [status:done] Define AppIconService interface and DefaultAppIconService implementation with resilient fetch and fallback
      covers: D1@1
      changes: src/browser/app-icon.ts
- [x] T002 [agent] [status:done] Define AppShortcutService interface and WindowsShortcutService implementation
      covers: D2@1
      changes: src/browser/app-shortcut.ts
- [x] T003 [agent] [status:done] Integrate AppIconService and AppShortcutService into DefaultPwaProvisioner via dependency injection
      covers: D3@1
      changes: src/browser/provisioner.ts
- [x] T004 [agent] [status:done] Test: Unit test AppIconService fetches and saves icon.ico cleanly with fallback
      covers: R1@1, R2@1, D1@1
      kind: test
      changes: src/browser/test/app-icon.test.ts
- [x] T005 [agent] [status:done] Test: Unit test AppShortcutService builds valid shortcut configuration
      covers: R3@1, D2@1
      kind: test
      changes: src/browser/test/app-shortcut.test.ts
- [x] T006 [agent] [status:done] Test: Provisioner triggers icon download and shortcut generation during provisioning
      covers: R1@1, R3@1, D3@1
      kind: test
      changes: src/browser/test/provisioner.test.ts
- [x] T007 [human] [status:done] Verify opening app from created shortcut shows application icon in taskbar and Start Menu
      covers: R1@1, R3@1
