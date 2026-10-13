# 014 - remove-pwasforfirefox-leftovers - Design

## Approach

- D1@1 (implements R1, R2): Remove `"--pwa", appSlug` from `buildStandaloneLaunchArgs` and `buildCleanStandaloneLaunchArgs` (`src/browser/standalone-runner.ts`) and from the shortcut args in `DefaultPwaProvisioner.provision` (`src/browser/provisioner.ts`). Reuse `buildStandaloneLaunchArgs` in the provisioner instead of duplicating the arg list (DRY). Drop `appSlug` from the builders' options if no longer used.
- D2@1 (implements R3): In `src/browser/pwa-runtime.ts`, replace `firefoxPwaDir` + `runtimePath(dir)` with the pure `resolveFirefoxBinary(platform, env, checkExists)` over `firefoxCandidates` (Mozilla default install locations; first existing wins). `PWA_NAV_FIREFOX_BINARY` is the only override (replaces `PWA_NAV_RUNTIME_DIR` and `PWA_NAV_FIREFOXPWA_DIR`); a missing install fails with `invalid_args` and an install hint. The provisioner takes `env` by injection. The profile adds `taskbar.grouping.useprofile` so each app gets its own Windows taskbar group instead of grouping with regular Firefox.
- D3@1 (implements R4): Update the `runtimePath` error hint and any `--pwa` text in messages.
- D4@1 (implements R5): Rewrite `docs/firefox-pwa.md` (renamed to `docs/firefox-runtime.md`) and fix references in `README.md`, `SKILL.md`, `AGENTS.md`, `docs/mcp.md`.
- D5@1 (implements R6): Tests asserting launch args, shortcut args and runtime paths updated; no test expects `--pwa` or `FirefoxPWA`.

## Deliverables

- `src/browser/standalone-runner.ts`, `src/browser/provisioner.ts`, `src/browser/pwa-runtime.ts`, `src/browser/bidi-backend.ts` (D1-D3).
- Tests in `src/browser/test/` (`standalone-runner`, `provisioner`, `pwa-runtime`, `bidi-backend`, `app-shortcut`) (D5).
- Docs (D4).

## Sequencing

D1 first (fixes the user-facing error), then D2/D3, then D4, with D5 alongside each.

## Decisions

- Q1 (resolved 2026-10-13): default to stock Firefox (Windows `Program Files`/`LOCALAPPDATA`, Linux `/usr/bin` and lib dirs, macOS `/Applications`), override via `PWA_NAV_FIREFOX_BINARY`. Spec 012 window chrome relies only on stock prefs (`userChrome.css`, `browser.tabs.inTitlebar`).
