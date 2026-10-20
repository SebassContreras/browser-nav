# 021 - automatic-auth-cookie-sync - Requirements

## What's being built

An automatic authentication and cookie synchronization subsystem that extracts existing authenticated session cookies and storage from the user's default browser profile directly into the PWA's profile or injects them dynamically via WebDriver BiDi `storage.setCookie`, deprecating and discarding the manual "clean mode / restart / assisted-auth" workflow from spec 016.

## Who it serves

Solo developers and autonomous agents working on login-walled web applications (such as LinkedIn, Google NotebookLM, Mercadona, and enterprise portals) who need immediate, seamless authenticated access without manual browser restarts or interactive login interruptions.

## Requirements

- R1@1: Default Firefox profile cookie extraction: Automatically discover the user's primary/default Firefox profile on Windows (`%APPDATA%\Mozilla\Firefox\Profiles`), Linux (`~/.mozilla/firefox`), and macOS (`~/Library/Application Support/Firefox`), reading unencrypted domain cookies from `cookies.sqlite` for the target application origin.
- R2@1: Zero-restart automatic cookie synchronization: Synchronize relevant session cookies and storage into the PWA instance either upon profile provisioning or dynamically via WebDriver BiDi `storage.setCookie` without terminating or restarting the active browser process.
- R3@1: Deprecation and removal of the manual assisted-auth clean/restart workflow: Discard the manual `clean -> wait-for-human -> terminate -> restart debug` workflow introduced in Spec 016 (`AuthWorkflowOrchestrator`), replacing `pwa_auth` with an automatic cookie/session sync operation.
- R4@1: Configurable source profile and cookie import fallback: Support configuring a custom source profile path or importing session cookies from an exported JSON/env format when automatic discovery is not applicable.
- R5@1: Safety barrier preservation: Maintain the core safety rules preventing automated entry of plaintext credentials into login forms and blocking interactions on sensitive payment/token fields.

## Out of scope

- Decrypting OS-level DPAPI or Keychain encrypted cookies from third-party Chromium browsers (Chrome/Edge/Brave).
- Bypassing multi-factor authentication (MFA) or hardware security keys when valid session cookies do not exist.

## Dependencies

- 002 (multi-pwa-isolation: `.agent/apps/<slug>/profile` directory structure).
- 004 (standalone-pwa-no-extension: security gate and `allow.json`).
- 016 (assisted-auth-transition: existing auth orchestration to be superseded).

## Owner split

Agent: profile discovery, cookie extractor, BiDi cookie synchronizer, auth workflow refactoring, unit tests. Human: test automatic authentication with personal logged-in Firefox profiles.
