# 014 - remove-pwasforfirefox-leftovers - Requirements

## What's being built

Removal of the PWAsForFirefox leftovers that survived spec 006. The `--pwa <slug>` launch flag makes the PWAsForFirefox-patched runtime read `%APPDATA%\FirefoxPWA\config.json` and look up an app ID that pwa-nav never registers, failing with "Failed to load the PWAsForFirefox configuration file." (observed launching the spec 013 shortcut). The runtime directory discovery, env vars, naming and docs still assume a PWAsForFirefox install.

## Who it serves

Users and agents launching standalone apps, who currently get a PWAsForFirefox error dialog, and maintainers who expect the "zero PWAsForFirefox dependency" promise from spec 006 to hold.

## Requirements

- R1@1: No launch path passes `--pwa`: standalone launch, clean launch, and the desktop shortcut (spec 013) start Firefox with `--profile <dir> [--remote-debugging-port <port>] <url>` only.
- R2@1: Launching never reads or requires PWAsForFirefox's `config.json`; the "Failed to load the PWAsForFirefox configuration file." error does not appear.
- R3@1: Runtime discovery is not tied to PWAsForFirefox: rename `firefoxPwaDir` to a neutral name, drop `LEGACY_DIR_ENV` (`PWA_NAV_FIREFOXPWA_DIR`), and stop defaulting to `FirefoxPWA`/`firefoxpwa` data dirs (see open question in design).
- R4@1: Hints and error messages (`runtimePath`, `launchCommandHint` usage) no longer mention `--pwa` or PWAsForFirefox.
- R5@1: Docs (`docs/firefox-pwa.md`, `README.md`, `SKILL.md`, `AGENTS.md`) describe the launch without `--pwa` and without PWAsForFirefox paths; `docs/firefox-pwa.md` is renamed or rewritten accordingly.
- R6@1: Window chrome (spec 012) and the app icon/shortcut (spec 013) keep working without `--pwa`.

## Out of scope

- Uninstalling PWAsForFirefox from the user's machine.
- Linux `.desktop` / macOS `.app` shortcuts.

## Dependencies

- 006, 012, 013.

## Owner split

Agent: code, tests, docs. Human: verify the shortcut and `open --launch` start without the PWAsForFirefox error and keep icon + native window controls.
