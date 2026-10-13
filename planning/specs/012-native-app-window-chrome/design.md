# 012 - native-app-window-chrome - Design

## Approach

- D1@1 (implements R1, R2, R4): Configure native OS title bar support in `DEFAULT_STANDALONE_USER_PREFS` (`src/browser/standalone-profile.ts`) via `browser.tabs.inTitlebar: 0`, ensuring Firefox delegates the window frame, drag region, and minimize/maximize/close controls directly to the underlying operating system window manager. _(standard: Firefox Desktop Preferences & CSD controls - https://wiki.mozilla.org/Client-Side_Decorations)_
- D2@1 (implements R1, R4): Refactor `STANDALONE_USER_CHROME_CSS` to hide `#nav-bar` and collapse tab strips without wiping out or collapsing window control button containers (`#titlebar-buttonbox` / native frame decorations).
- D3@1 (implements R3): Ensure profile teardown and CLI commands cleanly terminate the standalone Firefox process when closed via native 'X' or process termination.

## Deliverables

- `src/browser/standalone-profile.ts` - updated `DEFAULT_STANDALONE_USER_PREFS` and `STANDALONE_USER_CHROME_CSS` (D1, D2).
- Unit tests in `src/browser/test/standalone-profile.test.ts` verifying that `browser.tabs.inTitlebar` preference is set to `0` and CSS rules preserve native frame visibility (D1, D2).
- Verification documentation in `planning/handoff.md` with instructions for human manual window check (R2, R3).

## Sequencing

D1 and D2 update profile preferences and CSS definitions. Verification tests validate the profile generated files.

## Open questions

None.
