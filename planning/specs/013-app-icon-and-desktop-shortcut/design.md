# 013 - app-icon-and-desktop-shortcut - Design

## Approach

- D1@1 (implements R1, R2, R4): `AppIconService` interface (`src/browser/app-icon.ts`) provides an anti-corruption wrapper for fetching and writing an app's icon. `DefaultAppIconService` fetches the origin's `/favicon.ico` (or specified icon URL), ensures `.agent/apps/<slug>/icon.ico` is written, and falls back gracefully if the host is unreachable.
- D2@1 (implements R3, R4): `AppShortcutService` interface (`src/browser/app-shortcut.ts`) provides an anti-corruption wrapper for OS shortcut registration. `WindowsShortcutService` creates/updates `.lnk` shortcuts (in Start Menu / Desktop or apps directory) targeting `runtime/firefox.exe` with arguments `--profile <profileDir> --pwa <slug>` and `iconLocation: icon.ico`.
- D3@1 (implements R1, R3): In `DefaultPwaProvisioner` (`src/browser/provisioner.ts`), compose `AppIconService` and `AppShortcutService` via dependency injection (SRP / DRY) to trigger non-blocking icon setup and shortcut creation during `provision()`.

## Deliverables

- `src/browser/app-icon.ts` - `AppIconService` interface and `DefaultAppIconService` implementation (D1).
- `src/browser/app-shortcut.ts` - `AppShortcutService` interface and platform implementation (D2).
- Updates to `src/browser/provisioner.ts` - inject icon and shortcut services into provisioning workflow (D3).
- Unit tests in `src/browser/test/app-icon.test.ts` (D1).
- Unit tests in `src/browser/test/app-shortcut.test.ts` (D2).
- Integration tests in `src/browser/test/provisioner.test.ts` (D3).

## Sequencing

D1 and D2 define the domain interfaces and service adapters. D3 composes them into `DefaultPwaProvisioner`.

## Open questions

None.
