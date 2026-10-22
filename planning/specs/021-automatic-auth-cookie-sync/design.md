# 021 — automatic-auth-cookie-sync — Design

## Approach

- D1@1 (implements R1): Cross-platform Firefox default profile discovery via pure resolution functions in `src/browser/firefox-profile-discovery.ts`. Implements `FirefoxProfileLocator` locating `%APPDATA%\Mozilla\Firefox\Profiles` (Windows), `~/.mozilla/firefox` (Linux), and `~/Library/Application Support/Firefox/Profiles` (macOS). Identifies default profiles by parsing `profiles.ini` (standard `Default=1` or `.default-release` suffix) without executing OS shell commands.
- D2@1 (implements R1, R2): Read-safe unencrypted cookie extraction service `FirefoxCookieExtractor` in `src/browser/cookie-extractor.ts`. To safely read `cookies.sqlite` while Firefox is running without hitting database file locks (`busy` / `locked`), it copies the source database and its WAL file to a temporary file (`os.tmpdir()`), queries the plain-text `moz_cookies` table using Node 24 native `node:sqlite` (`DatabaseSync`), filters rows matching the target app's root domains (e.g. `.google.com`, `.linkedin.com`, `mercadona.es`), maps them to standard cookie records, and immediately cleans up the temporary copy.
- D3@1 (implements R2, R4): Zero-restart cookie synchronizer `CookieSyncService` in `src/browser/cookie-sync.ts`. Supports dual-mode injection:
  1. *Runtime BiDi Injection*: Injects extracted cookies directly into the running PWA session using WebDriver BiDi `storage.setCookie` with exact partition keys (`sourceOrigin` / `userContext`) without requiring a browser restart.
  2. *Cold Profile Seeding*: When provisioning a new PWA profile (`src/browser/provisioner.ts`), seeds initial cookies directly into the target profile's `cookies.sqlite` before launch.
- D4@1 (implements R3): Deprecation and removal of the manual assisted-auth clean/restart workflow. Replaces `AuthWorkflowOrchestrator` in `src/browser/auth-watcher.ts` and `src/tools/auth.ts`. `pwa-nav auth <app>` and MCP `pwa_auth` become automated synchronization operations: they run auto-sync, verify session health (`session-health.ts`), and return the authenticated status verdict (`authenticated` vs `unauthenticated`) without prompting the user or terminating the browser.
- D5@1 (implements R5): Strict preservation of safety boundaries. Automated session synchronization operates purely on transport/session cookies. It never touches, captures, or populates password input fields, TOTP inputs, or payment frames, maintaining full compliance with the core safety gate (`src/core/security.ts`).

## Trade-offs & Mitigations

- **Decision 1: Native `node:sqlite` vs. external `better-sqlite3` or python script.**
  - *Pros*: Node 24 includes `node:sqlite` built-in; zero native C++ compile steps, zero additional node dependencies in `package.json`, completely cross-platform.
  - *Cons*: `node:sqlite` is marked experimental in Node 22 but fully stable in Node 24.
  - *Mitigation*: Gracefully handle initialization with fallback error reporting; the project standard is Node 22/24 LTS.
- **Decision 2: Temporary SQLite file copy vs. reading locked active database.**
  - *Pros*: Completely prevents SQLite database locking exceptions (`SQLITE_BUSY`, `SQLITE_LOCKED`) when the user has their regular Firefox browser open while testing.
  - *Cons*: Minor ephemeral disk I/O in `os.tmpdir()`.
  - *Mitigation*: The copy is restricted to `cookies.sqlite` (typically 1-5 MB), executes in ~5ms, and is deleted in a `finally` block immediately after query execution.
- **Decision 3: BiDi `storage.setCookie` vs. full profile directory cloning.**
  - *Pros*: Granular domain-scoped cookie sync prevents profile bloating, avoids copying gigabytes of caches or history, and does not conflict with Firefox `parent.lock`.
  - *Cons*: BiDi `storage.setCookie` requires an active WebSocket connection.
  - *Mitigation*: Dual-mode support: cold profile seeding during `provision()` before launch, and dynamic BiDi injection during active sessions.

## Deliverables

- `src/browser/firefox-profile-discovery.ts`: Profile resolution (`locateDefaultFirefoxProfile`, `parseProfilesIni`).
- `src/browser/cookie-extractor.ts`: `FirefoxCookieExtractor`, schema types, temporary copy reader, domain matcher.
- `src/browser/cookie-sync.ts`: `CookieSyncService` with BiDi `storage.setCookie` and cold-seeding.
- `src/tools/auth.ts`: Refactored `authTool` replacing manual restart orchestrator with automated sync.
- `src/tools/open.ts` & `src/browser/provisioner.ts`: Hook cookie seeding on initial app provisioning.
- `src/browser/test/firefox-profile-discovery.test.ts`: Isolated unit tests for profile detection across platforms.
- `src/browser/test/cookie-extractor.test.ts`: Unit tests reading sample `cookies.sqlite` fixtures with Given-When-Then.
- `src/browser/test/cookie-sync.test.ts`: Integration tests for BiDi `storage.setCookie` injection and cold profile seeding.
- `src/tools/test/auth.test.ts`: Behavior verification for automated `pwa_auth`.

## Sequencing

1. Implement `FirefoxProfileLocator` and unit tests (`src/browser/firefox-profile-discovery.ts`).
2. Implement `FirefoxCookieExtractor` with temporary SQLite copy logic and unit tests using mock SQLite fixtures.
3. Implement `CookieSyncService` supporting BiDi `storage.setCookie` and cold profile database seeding.
4. Integrate automatic cookie seeding into `DefaultPwaProvisioner` and `openTool`.
5. Refactor `authTool` and MCP `pwa_auth` to remove the clean/restart loop in favor of automated cookie sync.
6. Verify full test suite and clean spectrace check.
