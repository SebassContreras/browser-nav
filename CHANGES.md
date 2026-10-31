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
