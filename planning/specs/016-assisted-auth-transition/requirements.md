# 016 - assisted-auth-transition - Requirements

## What's being built

An automated end-to-end assisted authentication flow (`pwa-nav auth <app> --auto` and MCP `pwa_auth({ action: "auto", app: "<app>" })`) for login-walled applications (such as Google NotebookLM and Cloudflare-protected sites).
It launches the PWA in clean mode (without remote debugging flags so Google anti-bot checks do not block credential input), actively monitors the profile's SQLite cookie store in the background for a valid authenticated session verdict, cleanly closes the clean browser process as soon as login is detected, and immediately relaunches the app in debug mode on port 9222 ready for automation—all without requiring the user to manually close windows or run multiple sequential commands.

## Who it serves

Users and agents automating login-walled PWAs who experience friction or lock contention (`session_busy`) when juggling manual browser closure and multi-step `auth clean` / `auth debug` commands.

## Requirements

- R1@1: Session detection: actively watch profile cookie storage (`cookies.sqlite`) in read-only mode until a valid session verdict (`authenticated`) is confirmed for the target host or timeout expires.
- R2@1: Graceful process termination: upon confirming the authenticated verdict, cleanly request process closure for the clean Firefox window and verify release of profile locks (`parent.lock`) before subsequent operations.
- R3@1: Automatic debug relaunch: immediately after lock release, relaunch the standalone PWA in debug mode (`--remote-debugging-port 9222`) preserving the authenticated session and original destination URL.
- R4@2: Pure KISS interface: simplify CLI and MCP to a single unified assisted auth command (`pwa-nav auth <app>` and MCP `pwa_auth({ app: "<app>" })`), retiring obsolete manual `clean` and `debug` flags/actions entirely.
- R5@1: Timeout and cancellation safety: support configurable timeout (default 180s) and cancellation (`AbortSignal`); on timeout or error, report actionable status without leaving orphaned processes or corrupt lock states.

## Out of scope

- Synthetic DOM credential typing or CAPTCHA solving (user types credentials manually in the clean window).
- Hot-patching `--remote-debugging-port` into a running Firefox process (infeasible due to Gecko architecture).
- In-page HTML overlays or synthetic UI buttons inside the web content.

## Dependencies

- 007 (session-health-check: `withProfileDb`, `evaluateSessionHealth`).
- 008 (profile-lock-diagnostics: `inspectProfileLock`).

## Owner split

Agent: service interfaces, watcher adapter, terminator adapter, workflow orchestrator, CLI/MCP updates, tests. Human: verify logging into Google in the clean window triggers automatic closure and debug relaunch.
