# Requirements: Package and Documentation Canonical Convergence to browser-nav

## Context

Following the canonical renaming introduced in Spec 028 (which established `browser_*` MCP tools, `browser-nav`/`bnav` CLI executables, and `BROWSER_NAV_*` environment variables), remaining historical references in `package.json`, agent instructions, and user documentation continue to reference legacy `pwa-nav`. This creates ambiguity for AI agents and human users regarding the canonical identity, primary command invocation, and package metadata.

This specification completes the project-wide convergence by updating `package.json` package metadata to `browser-nav`, updating all CLI examples and agent playbooks across documentation (`README.md`, `AGENTS.md`, `SKILL.md`, `docs/`) to use `browser-nav` as the primary command, and ensuring full backward compatibility for legacy references.

## Requirements

- R1@1: `package.json` package identity MUST be updated to `"name": "browser-nav"`, with `"description"` reflecting real Firefox browser automation over W3C WebDriver BiDi, while maintaining backward-compatible bin aliases (`pwa-nav`, `pwa-nav-mcp`).
- R2@1: User and agent entry documentation (`README.md`, `AGENTS.md`, `SKILL.md`) MUST canonically use `browser-nav` (or alias `bnav`) in all CLI usage examples, operational loops, and command signatures, replacing legacy `pwa-nav` CLI invocations.
- R3@1: Environment variable documentation in `README.md`, `AGENTS.md`, `SKILL.md`, and `docs/` MUST document `BROWSER_NAV_*` variables as canonical, noting `PWA_NAV_*` as supported legacy fallbacks.
- R4@1: Documentation files under `docs/` (`docs/mcp.md`, `docs/screen-map.md`, `docs/firefox-runtime.md`) MUST be updated to reference `browser-nav` and canonical MCP server configurations (`browser-nav-mcp` or `node dist/mcp.js`).
- R5@1: All existing unit, integration, and smoke tests MUST continue to pass, verifying that the package name change and documentation alignment do not break exports, test fixtures, or execution contracts.
