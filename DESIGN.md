# CLI & Content Design Guidelines

This repository has no graphical UI. This document governs the CLI surface (arguments, flags, output formats, errors, exit codes) and the editorial style of documentation. AI agents must follow it when adding commands, changing output, or writing docs.

---

## ⌨️ CLI Conventions

### 1. Commands & Arguments
- Binaries: `browser-nav` (aliases `bnav`, legacy `pwa-nav`) and `browser-nav-mcp` (legacy `pwa-nav-mcp`).
- Verb-first subcommands: `open`, `snapshot`, `find`, `click`, `fill`, `upload`, `download`, `act`, `journey`, `wait`, `extract`, `screenshot`, `auth`, `qa`, `screens`.
- Targets are semantic `@id`s (screen map), ephemeral refs (`eN`), or accessible names. In shells, always quote: `'@id'`.
- Batch actions use `kind:target=value` tokens (`fill:@search=query`, `click:@submit`); flow/journey params are `key="value"`.

### 2. Flags
- Long, kebab-case flags (`--dry-run`, `--screens-dir`, `--cache-dir`, `--allow-origin`).
- Every flag that configures runtime has an env var `BROWSER_NAV_<FLAG>` with `PWA_NAV_<FLAG>` as legacy fallback.
- Safe defaults: CLI mutations are dry-run unless `--armed`; MCP is armed unless `--dry-run`.
- New flags need no alias unless replacing a legacy name.

### 3. Output Formats
- Compact text on stdout by default; `--json` prints the structured result. Errors go to stderr.
- Snapshots default to a compact, interactive-only tree with the active dialog (`activeDialog`) first; the full tree only on demand.
- Binary artifacts (screenshots, evidence) go to disk; output reports only `{path, width, height}`.
- Errors carry a stable `code` string plus a recovery hint.

### 4. Error Codes & Exit Codes

| Exit | Code | Meaning & recovery |
|:---:|---|---|
| `0` | `ok` | Success. |
| `1` | `failure` | Operation or QA check failed; see stderr. |
| `2` | `invalid_args` | Malformed arguments/flags; run with `--help`. |
| `3` | `stale_ref` | Snapshot or `eN` ref expired; re-snapshot and retry. |
| `4` | `no_browser` | BiDi port closed; launch with `open <app>`. |
| `5` | `session_busy` | Another BiDi client is connected; close it or restart Firefox. |
| `6` | `origin_blocked` | Origin not allow-listed; ask the user, then `open <url> --allow-origin`. |
| `7` | `kill_switch` | `.agent/kill` present; stop and wait for the user. |
| `8` | `not_actionable` | Element covered, disabled, hidden, or readback mismatch; re-snapshot. |
| `9` | `timeout` | Action/navigation timed out; retry once. |
| `10` | `protocol` | BiDi protocol mismatch; check connection parameters. |
| `11` | `sensitive_target` | Sensitive field or human-only flow; ask the user to do it by hand. |
| `12` | `unknown_target` | `@id` not in the screen map; run `snapshot --screen`. |
| `13` | `unmapped_screen` | URL not mapped; run `screen_learn` / `snapshot --learn`. |
| `14` | `journey_step_failed` | Journey step or route transition mismatch; verify screen state. |
| `15` | `file_upload_blocked` | Upload path outside safe dirs or sensitive; use workspace root or `.agent/`. |

New error codes take the next free exit code and are added to this table, `README.md`, and `src/core/` together.

---

## 📝 Editorial Style

- **Language:** docs in English; user chat in Spanish. Code symbols, commands, paths, and keys always in English.
- **Tone:** terse, structural, imperative for procedures. No marketing language.
- **Structure:** one H1 per document; no skipped heading levels; tables for flag/parameter/error references; backticks for paths, flags, and identifiers.
- **Diagrams:** Mermaid `flowchart TD`/`LR`, ≤12 nodes, quoted labels with special characters.
- **Callouts:** GitHub alerts (`> [!WARNING]` etc.) sparingly, for destructive or safety-critical steps.
