# 020 - dynamic-workspace-storage - Requirements

## What's being built

A dynamic workspace and session storage configuration system for MCP and CLI. It enables agents and operators to view and switch the active cache directory (`.agent` vs global `~/.pwa-nav`) at runtime without restarting the MCP server, provides per-call workspace overrides, and auto-detects project roots from MCP client initialization handshakes.

## Who it serves

Developers and agents using `pwa-nav` across multiple distinct projects or within global IDE/editor MCP server configurations where the server process's working directory (`process.cwd()`) does not match the active project folder.

## Requirements

- R1@1: Dynamic configuration MCP tool (`pwa_config`): Expose a dedicated MCP tool allowing the agent or user to inspect current storage settings (active `cacheDir`, `screensDir`, project root, fallback mode) and switch the active `workspaceDir` or `cacheDir` dynamically for subsequent operations in the current session.
- R2@1: Per-call workspace override: Allow core tools (`open`, `snapshot`, `click`, `fill`, etc.) to accept an optional `workspaceDir` or `cacheDir` parameter to target project-isolated state on demand without mutating global server state.
- R3@1: MCP `initialize` workspace folder auto-detection: When the MCP client provides `rootUri` or `workspaceFolders` during the protocol initialization handshake, automatically bind the session's default storage to `<projectRoot>/.agent` instead of falling back to global `~/.pwa-nav`.
- R4@1: Clean project isolation and global fallback: Ensure profiles (`.agent/apps/<slug>/profile`), screen maps (`screens.json`), allow-lists (`allow.json`), and session states cleanly converge inside the selected workspace folder when set, preserving `~/.pwa-nav` as the global user fallback when no project workspace is active.

## Out of scope

- Synchronizing or migrating browser profiles between different workspaces automatically.
- Remote or cloud-based workspace storage (local filesystem only).

## Dependencies

- 002 (multi-pwa-isolation: `.agent/apps/<slug>/profile` directory structure).
- 018 (canonical-app-origin-mapping: unified app folder convergence).

## Owner split

Agent: config tool implementation, MCP server dynamic context, storage resolution updates, unit tests. Human: verify multi-project workspace switching in real editor sessions.
