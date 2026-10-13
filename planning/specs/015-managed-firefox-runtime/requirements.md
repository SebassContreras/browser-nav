# 015 - managed-firefox-runtime - Requirements

## What's being built

A Firefox runtime that pwa-nav downloads and owns, so a general user who only installs the MCP server can open standalone apps without installing Firefox or PWAsForFirefox. The runtime is the official Mozilla Firefox, extracted (not installed) into pwa-nav's own data dir: no registry entries, no shortcuts, no default-browser change, no admin rights. It is downloaded only with the user's explicit consent.

## Who it serves

General users of the MCP server (Claude Desktop, Cursor, etc.) who have no Firefox, or use another browser (Chrome, Zen, Edge), and should never need a terminal; and agents that need a deterministic way to recover from "no Firefox found".

## Requirements

- R1@1: Binary resolution order: `PWA_NAV_FIREFOX_BINARY` → stock Firefox installed in a default location (spec 014) → pwa-nav managed runtime. Resolution stays a pure function with injected existence checks.
- R2@1: Managed runtime location: `<user data dir>/pwa-nav/runtime/firefox/` (Windows `%LOCALAPPDATA%\pwa-nav\runtime\firefox\firefox.exe`), independent of the repo and of `.agent/`. Overridable with `PWA_NAV_RUNTIME_DIR`.
- R3@1: Install source and integrity: download only over HTTPS from Mozilla (`product-details.mozilla.org` for the latest release version, `archive.mozilla.org` for the build), and verify the file's SHA-512 against the release's `SHA512SUMS` before use. A mismatch aborts and deletes the download.
- R4@1: No side effects on the system: Windows uses the full installer's `/ExtractDir=<dir>` (extract only). Nothing is registered, no shortcut, no default browser, no maintenance service, no admin prompt.
- R5@1: Consent: nothing is downloaded without explicit user consent. The MCP server asks via MCP elicitation ("pwa-nav needs Firefox, official Mozilla download, ~80 MB. Download?") when the client supports it; otherwise the launch fails with `no_browser` and a hint to call the `pwa_install_runtime` tool, whose invocation is gated by the client's tool approval.
- R6@1: `pwa_install_runtime` MCP tool and `pwa-nav runtime install` CLI command install or update the managed runtime and report version, path and size; `pwa-nav runtime status` reports which binary would be used and why.
- R7@1: Atomic install: download to a temp file, extract to a staging dir, then rename into place; a failed or interrupted install never leaves a half-usable runtime.
- R8@1: Clear failures: offline, proxy, hash or disk errors return a typed error with a hint (install Firefox manually or set `PWA_NAV_FIREFOX_BINARY`).
- R9@1: Platforms: Windows implemented; Linux (`.tar.xz`) and macOS (`.dmg`) return `no_browser` with a manual install hint until implemented.

## Out of scope

- Background auto-update of the managed runtime (re-running install updates it).
- Linux and macOS installers (R9 hint only).
- Bundling Firefox inside the npm package.
- Removing PWAsForFirefox from the user's machine.

## Dependencies

- 014 (stock Firefox resolution, no `--pwa`).

## Owner split

Agent: resolver, installer adapter, consent flow, MCP tool, CLI, tests, docs. Human: on a machine without Firefox, accept the consent prompt from an MCP client and verify the app opens with native window chrome and icon; verify nothing appears in installed programs or default-browser settings.
