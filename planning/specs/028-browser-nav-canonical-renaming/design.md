# 028 — browser-nav-canonical-renaming — Design

## Approach

Applying the 10 Core Engineering Principles:
1. **KISS / YAGNI (Principle 1)**: Implement canonical tool names (`browser_*`, `screen_learn`) and legacy alias routing (`pwa_*`) via a flat, deterministic constant lookup map (`LEGACY_TOOL_ALIASES`) and a pure environment/storage resolution helper. Do not introduce dynamic proxy classes, middleware pipelines, or plugin registries for a 1-to-1 namespace mapping.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/mcp/mcp-tools.ts`: Owns the canonical `TOOLS` manifest (`browser_*` and `screen_learn`) and the `LEGACY_TOOL_ALIASES` dictionary mapping each legacy `pwa_*` tool name to its canonical name.
   - `src/mcp/mcp-server.ts`: Owns registering canonical tools in `ListToolsRequestSchema` while indexing both canonical names and `LEGACY_TOOL_ALIASES` in the internal `compiled` dispatch map for `CallToolRequestSchema`.
   - `src/core/storage.ts`, `src/core/gate.ts`, `src/cli.ts`, `src/mcp.ts`: Own `BROWSER_NAV_*` environment variable resolution with fallback to `PWA_NAV_*` and global directory resolution (`~/.browser-nav` with fallback to existing `~/.pwa-nav`).
   - `package.json`: Owns the CLI executable bin entries (`browser-nav`, `bnav`, `pwa-nav`, `browser-nav-mcp`, `pwa-nav-mcp`).
3. **DRY via Composition (Principle 3)**: Reuse the exact same `ToolDef` and compiled Ajv `ValidateFunction` entry in `src/mcp/mcp-server.ts` for both the canonical tool name and its legacy `pwa_*` alias, and extract a small pure helper `readEnv(env, canonicalKey, legacyKey)` so environment variable fallback logic is never duplicated across modules.
4. **Service Layer & Anti-Corruption (Principles 4 & 5)**: Keep MCP tool naming and alias translation strictly inside `src/mcp/`, and environment/path fallback inside `src/core/storage.ts` and `src/core/gate.ts`, with injectable `env` and `homeDir` parameters so all resolution functions remain pure and deterministically testable without mutating `process.env` or touching the real user home directory.
5. **Testing Behavior & Hygiene (Principles 6 & 7)**: Write focused behavioral tests in `src/mcp/test/mcp-server.test.ts`, `src/core/test/storage.test.ts`, `src/core/test/gate.test.ts`, and `src/cli/test/cli.test.ts` following Given-When-Then / Arrange-Act-Assert without conditionals or loops in new tests, covering R1–R5.
6. **Follow the Stack's Standards (Principle 8)**: Adhere to MCP specification (`tools/list`, `tools/call`), npm `package.json` `bin` conventions, and TypeScript strict mode.
7. **Validate with Research (Principle 9)**: Validated against MCP ecosystem conventions (Playwright MCP / Anthropic computer-use / browser-use `browser_*` tool namespaces) and the root-cause analysis in `planning/investigation-screen-maps-and-agent-behavior.md` (Hypothesis 1.2: *"The entire tool suite uses the prefix `pwa_` ... Pre-training datasets strongly associate 'PWA' with local desktop apps, causing LLMs to skip `pwa_*` tools for general web browsing"*).

### Decisions

- D1@1 (implements R1): **Canonical `browser_*` and `screen_learn` MCP Tool Manifest**. In `src/mcp/mcp-tools.ts`, rename the 16 `ToolDef.name` entries in `TOOLS` to their canonical names:
  - `browser_config` (was `pwa_config`)
  - `browser_open` (was `pwa_open`)
  - `browser_install_runtime` (was `pwa_install_runtime`)
  - `browser_auth` (was `pwa_auth`)
  - `browser_snapshot` (was `pwa_snapshot`)
  - `browser_click` (was `pwa_click`)
  - `browser_fill` (was `pwa_fill`)
  - `browser_upload` (was `pwa_upload`)
  - `browser_download` (was `pwa_download`)
  - `browser_screenshot` (was `pwa_screenshot`)
  - `browser_extract` (was `pwa_extract`)
  - `browser_find` (was `pwa_find`)
  - `browser_act` (was `pwa_act`)
  - `screen_learn` (was `pwa_learn`)
  - `browser_wait` (was `pwa_wait`)
  - `browser_discover` (was `pwa_discover`)
  Update `BASE_INSTRUCTIONS` in `src/mcp/mcp-server.ts` and tool descriptions in `src/mcp/mcp-tools.ts` to reference the canonical `browser_*` and `screen_learn` tool names while noting backward compatibility with `pwa_*`. `ListToolsRequestSchema` returns only the canonical `TOOLS` (plus any dynamic `flow_*` and `journey_*` tools) so the advertised manifest is clean and free of duplicate tool definitions.
- D2@1 (implements R2): **Transparent Inbound `pwa_*` Legacy Alias Routing (`LEGACY_TOOL_ALIASES` & `resolveToolName`)**. In `src/mcp/mcp-tools.ts`, export `LEGACY_TOOL_ALIASES: Readonly<Record<string, string>>` mapping all 16 legacy `pwa_*` names (`pwa_open` -> `browser_open`, ..., `pwa_learn` -> `screen_learn`, `pwa_extract` -> `browser_extract`) and a pure function `resolveToolName(name: string): string` that returns `LEGACY_TOOL_ALIASES[name] ?? name`. In `src/mcp/mcp-server.ts`, resolve `request.params.name` through `resolveToolName` in `CallToolRequestSchema` (or index aliases in `compiled`) so inbound calls to `pwa_open`, `pwa_click`, `pwa_learn`, etc. validate against the exact same Ajv schema and invoke the exact same handler without error or deprecation failure.
- D3@1 (implements R3): **CLI Executable Bins (`browser-nav`, `bnav`, `pwa-nav`)**. In `package.json`, configure `"bin"` to expose:
  - `"browser-nav": "./dist/cli.js"`
  - `"bnav": "./dist/cli.js"`
  - `"pwa-nav": "./dist/cli.js"`
  - `"browser-nav-mcp": "./dist/mcp.js"`
  - `"pwa-nav-mcp": "./dist/mcp.js"`
- D4@1 (implements R4): **`BROWSER_NAV_*` Environment Variable Resolution with `PWA_NAV_*` Fallback**. Introduce a pure env lookup helper `readEnv(env, canonicalKey, legacyKey)` in `src/core/storage.ts` and apply it across `src/core/storage.ts`, `src/core/gate.ts`, `src/cli.ts`, and `src/mcp.ts`:
  - `BROWSER_NAV_PORT` -> fallback `PWA_NAV_PORT`
  - `BROWSER_NAV_CACHE_DIR` -> fallback `PWA_NAV_CACHE_DIR`
  - `BROWSER_NAV_SCREENS_DIR` -> fallback `PWA_NAV_SCREENS_DIR`
  - `BROWSER_NAV_DRY_RUN` -> fallback `PWA_NAV_DRY_RUN`
  - `BROWSER_NAV_KILL_SWITCH` -> fallback `PWA_NAV_KILL_SWITCH`
  - `BROWSER_NAV_BACKEND` -> fallback `PWA_NAV_BACKEND`
  When a `BROWSER_NAV_*` variable is set and non-empty, it takes precedence; when unset or empty, the resolver transparently falls back to the corresponding `PWA_NAV_*` variable.
- D5@1 (implements R5): **Global Directory Fallback (`~/.browser-nav` with `~/.pwa-nav` Legacy Continuity)**. In `src/core/storage.ts`, update `getGlobalDataDir(home?: string, checkExists?: (path: string) => boolean): string` so that:
  1. It checks `join(home, ".browser-nav")` and `join(home, ".pwa-nav")`.
  2. If `~/.browser-nav` already exists, or if neither directory exists on disk, it returns `join(home, ".browser-nav")` (preferring `~/.browser-nav` for all new installations).
  3. If `~/.browser-nav` does not exist on disk but legacy `~/.pwa-nav` already exists, it returns `join(home, ".pwa-nav")` so existing users' profiles, cookies, and screen maps continue working seamlessly without data loss or broken paths.

## Trade-offs & Mitigations (Principle 10)

- **Decision 1: Listing only canonical `browser_*` / `screen_learn` in `tools/list` while routing `pwa_*` silently in `tools/call` vs listing both in `tools/list`.**
  - *Pros*: Halves tool manifest token usage (16 tools instead of 32) and completely eliminates the "PWA" naming bias from the LLM's tool selection context (R1), while preserving 100% runtime compatibility for existing prompts, scripts, and tests that call `pwa_*` (R2).
  - *Cons*: Existing tests that assert `tools/list` contains `"pwa_open"` will see `"browser_open"` instead.
  - *Mitigation*: Update the manifest list assertions in `src/mcp/test/mcp-server.test.ts`, `src/mcp/test/mcp-download.test.ts`, and `src/mcp/test/mcp.bidi.stdio.test.ts` to expect the canonical `browser_*` / `screen_learn` names in `tools/list`, and add explicit behavioral tests verifying that calling every legacy `pwa_*` name via `tools/call` succeeds identically to its canonical counterpart.
- **Decision 2: Reading from existing `~/.pwa-nav` when `~/.browser-nav` does not exist vs auto-moving `~/.pwa-nav` on disk.**
  - *Pros*: Zero side effects during pure path resolution (`getGlobalDataDir`), and never risks corrupting an open Firefox profile lock (`parent.lock` / `lock`) if a browser instance is actively running from `~/.pwa-nav`.
  - *Cons*: Users with a pre-existing `~/.pwa-nav` folder keep using `~/.pwa-nav` until they remove or rename it or create `~/.browser-nav`.
  - *Mitigation*: `getGlobalDataDir` accepts injectable `home` and `checkExists` parameters, preferring `~/.browser-nav` whenever `~/.browser-nav` exists or on fresh setups, and seamlessly reading `~/.pwa-nav` when only the legacy directory exists.
- **Decision 3: Precedence when both `BROWSER_NAV_*` and `PWA_NAV_*` are set in the same environment.**
  - *Pros*: Deterministic rule: canonical `BROWSER_NAV_*` always wins over legacy `PWA_NAV_*`, while CLI flags (`--port`, `--cache-dir`, `--screens-dir`, `--dry-run`) still take top priority over all environment variables.
  - *Cons*: If a test wrapper sets `PWA_NAV_PORT` in `baseEnv` and a user has `BROWSER_NAV_PORT` exported in their shell, `BROWSER_NAV_PORT` could override `PWA_NAV_PORT`.
  - *Mitigation*: Clear or pin `BROWSER_NAV_*` alongside `PWA_NAV_*` in test harness `baseEnv` helpers (`src/cli/test/cli.test.ts`, `src/cli/test/cli.screens.test.ts`, `src/mcp/test/mcp.bidi.stdio.test.ts`) to keep test environments hermetic.

## Deliverables

- `src/mcp/mcp-tools.ts`: Canonical `browser_*` and `screen_learn` tool names in `TOOLS`, `LEGACY_TOOL_ALIASES` map, and `resolveToolName` helper.
- `src/mcp/mcp-server.ts`: Route inbound `CallToolRequestSchema` requests via `resolveToolName`, and update `BASE_INSTRUCTIONS` to reference canonical `browser_*` / `screen_learn` tools (while retaining `pwa_*` mention for backward compatibility).
- `package.json`: Add `browser-nav`, `bnav`, and `browser-nav-mcp` to `"bin"` alongside `pwa-nav` and `pwa-nav-mcp`.
- `src/core/storage.ts`, `src/core/gate.ts`, `src/cli.ts`, `src/mcp.ts`: Support `BROWSER_NAV_*` environment variables with fallback to `PWA_NAV_*`, and update `getGlobalDataDir` to prefer `~/.browser-nav` with fallback to existing `~/.pwa-nav`.
- `src/mcp/test/mcp-server.test.ts`, `src/core/test/storage.test.ts`, `src/core/test/gate.test.ts`, `src/cli/test/cli.test.ts`: Unit and integration tests covering R1–R5.
- `README.md`, `SKILL.md`, `docs/mcp.md`: Update documentation to reflect canonical `browser-nav` / `bnav` CLI bins, `browser_*` / `screen_learn` MCP tools, and `BROWSER_NAV_*` environment variables.

## Sequencing

1. Update `src/core/storage.ts`, `src/core/gate.ts`, `src/cli.ts`, `src/mcp.ts`, and `package.json` to implement `BROWSER_NAV_*` env resolution with `PWA_NAV_*` fallback (D4@1), `~/.browser-nav` global directory preference with `~/.pwa-nav` fallback (D5@1), and `browser-nav` / `bnav` CLI bin entries (D3@1).
2. Update `src/mcp/mcp-tools.ts` and `src/mcp/mcp-server.ts` (and `docs/mcp.md`, `SKILL.md`, `README.md`) to expose canonical `browser_*` and `screen_learn` tool names in `TOOLS` (D1@1) and transparently route legacy `pwa_*` tool calls via `resolveToolName` (D2@1).
3. Add and update unit/integration tests in `src/mcp/test/`, `src/core/test/`, and `src/cli/test/` verifying R1, R2, R3, R4, and R5.
4. Run full CI verification (`pnpm lint && pnpm build && pnpm test && pnpm smoke`) and `python .spectrace/trace.py check`.
