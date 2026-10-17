# 012 - native-app-window-chrome - Tasks

- [x] T001 [agent] [status:done] Update DEFAULT_STANDALONE_USER_PREFS and STANDALONE_USER_CHROME_CSS to retain native window titlebar and window controls
      covers: D1@1, D2@1
      changes: src/browser/standalone-profile.ts
- [x] T002 [agent] [status:done] Test: Verify standalone profile generates browser.tabs.inTitlebar=0 and valid window controls CSS
      covers: R1@1, R4@1, D1@1, D2@1
      kind: test
      changes: src/browser/test/standalone-profile.test.ts
- [x] T003 [human] [status:done] Verify dragging, minimizing, and closing window using native OS controls
      covers: R2@1, R3@1, D3@1
