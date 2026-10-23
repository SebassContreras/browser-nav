# Requirements: Browser-Nav Canonical Renaming

## Context

The legacy name `pwa-nav` and tool prefix `pwa_*` trigger semantic bias in LLMs, misleading agents into thinking the tool is only for local desktop-installed PWAs rather than general browser automation. Renaming canonically to `browser-nav` with tool namespace `browser_*` aligns with ecosystem standards (e.g. `browser_open`, `browser_click`), while transparent aliasing preserves 100% backward compatibility for existing setups.

## Requirements

- R1@1: The MCP server MUST declare canonical tool names with the `browser_*` prefix (`browser_open`, `browser_snapshot`, `browser_click`, `browser_fill`, `browser_find`, `browser_act`, `browser_wait`, `browser_download`, `browser_upload`, `browser_screenshot`, `browser_auth`, `browser_config`, `browser_install_runtime`, `browser_discover`) and `screen_learn` in its tool manifest.
- R2@1: The MCP server MUST transparently handle inbound tool calls using legacy `pwa_*` names (`pwa_open`, `pwa_click`, etc.), routing them to their respective canonical implementations without error or deprecation failure.
- R3@1: The CLI MUST provide `browser-nav` and `bnav` as primary executables alongside the legacy `pwa-nav` executable in `package.json` bins.
- R4@1: Environment variable resolution MUST support `BROWSER_NAV_*` variables (`BROWSER_NAV_PORT`, `BROWSER_NAV_CACHE_DIR`, `BROWSER_NAV_SCREENS_DIR`, `BROWSER_NAV_DRY_RUN`, `BROWSER_NAV_KILL_SWITCH`) with seamless fallback to legacy `PWA_NAV_*` variables.
- R5@1: Global directory fallback MUST prefer `~/.browser-nav`, migrating or reading from `~/.pwa-nav` if previously existing.
