# 013 - app-icon-and-desktop-shortcut - Requirements

## What's being built

Automatic application favicon resolution, conversion to native OS icon format (`icon.ico` for Windows), storage in `.agent/apps/<slug>/icon.ico`, and desktop/menu shortcut generation (`.lnk` on Windows, extensible to other desktop environments). Launching the application from the shortcut provides the native app icon in the OS taskbar and Start Menu.

## Who it serves

Users and agents who launch standalone web apps and expect native desktop integration with accurate branding in the Windows taskbar and application menus instead of the generic Firefox browser icon.

## Requirements

- R1@1: Favicon discovery and download: automatically resolve the application's favicon from `/favicon.ico` or HTML `<link rel="icon">` tags when provisioning an app.
- R2@1: Icon storage: convert and store the resolved icon as `.agent/apps/<slug>/icon.ico`. Fall back gracefully to a bundled default or clean placeholder without failing the provisioning if network resolution fails.
- R3@1: Shortcut creation: generate or update a desktop shortcut (`.lnk` on Windows) targeting the runtime executable with arguments `--pwa <slug>` and assigning the custom `icon.ico`.
- R4@1: Decoupled service layer: icon retrieval/conversion and shortcut creation must exist behind clear, testable, and swappable service interfaces (`AppIconService` and `AppShortcutService`), adhering to SRP, Anti-Corruption, and Dependency Inversion.

## Out of scope

- Windows exe binary resource patching / re-compilation of `firefox.exe` (launching `firefox.exe` directly via raw shell commands without shortcut will still inherit Firefox's executable icon due to Windows OS constraints).
- Linux `.desktop` and macOS `.app` deep bundling (reserved for platform extensions; interface will support them via composition).
- In-browser icon extractors that require full DOM page rendering before window launch.

## Dependencies

- 005 (automatic-pwa-provisioning).

## Owner split

Agent: service interfaces, icon download/conversion adapter, shortcut generator, tests. Human: verify taskbar and desktop shortcut icon presentation on Windows.
