# Architecture & Decision Changes

This document maintains a permanent ledger of architectural pivots, deprecated decisions, and significant scope modifications. It prevents agents from reintroducing rejected patterns and records why the system evolved.

---

## 🔄 Change Protocol

When an existing design or requirement needs to change:

1. **Document the rationale:** add a row to the [Change Log](#change-log) with date, scope, what changed, and why.
2. **Update the spec:** in the affected `planning/specs/NNN-name.md`, strike through the obsolete item and point to its replacement (`- ~~D1: …~~ → D2`), and add explicit cleanup tasks (`— replaces D1`) for obsolete code, tests, and docs.
3. **Update root context:** if boundaries, CLI surface, or scope change, update `PRODUCT.md`, `ARCHITECTURE.md`, or `DESIGN.md` in the same change.

---

## 📜 Change Log

| Date | Scope | What changed | Why |
|---|---|---|---|
| 2026-10-31 | Governance | Migrated to spectrace 0.32.0: 7 root contracts, 4 skills, .agentignore; removed .githooks, Spec: trailers and planning/product.md\|architecture.md\|styles.md | Adopt decoupled progressive disclosure and zero-hook model |
| 2026-10-31 | Governance | ENGINEERING.md gains §7 (research only when the decision needs it, cited as `Source: <url> (accessed YYYY-MM-DD)`); §4 heading matches the spectrace template; AGENTS.md principle lists name DRY, research and trade-offs; spectrace skills updated | Spectrace principle 7; the file had no research rule |
| 2026-11-02 | 035 / CLI & MCP | Screen map learning (`snapshot --learn`, `browser_snapshot({ learn: true })`, `screen_learn`) defaults `locale` to `"en"` across both CLI and MCP (`035/R2 → R4`, `035/D2 → D4`), replacing `"es"` default and legacy CLI `--locale` requirement | Uniform `"en"` default across CLI and MCP adapters without blocking new screen maps when `--locale` is omitted |
| 2026-11-03 | 041 / MCP flow maps | `loadScreenMapsFromDir` gains an `onInvalid` callback that reports and skips unreadable or schema-invalid maps; `preferFlowMap` selects one map deterministically (local over global, `apps/<slug>/screens.json` over flat, lexical tie-break); `loadFlowSource` never throws and logs skipped maps and the chosen path. Flow and journey tool descriptions now say "Executes live unless the server operator launched it with `--dry-run`" | Previously the loader required exactly one valid map, so a single stale sibling file started `browser-nav-mcp` with no flow or journey tools, and the descriptions claimed a dry-run default while `armed = !isDryRun` |
