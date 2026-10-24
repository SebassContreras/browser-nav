# 031 — package-and-docs-canonical-convergence — Design

## Approach

Applying the 10 Core Engineering Principles:

1. **KISS / YAGNI (Principle 1)**: Keep the convergence straightforward and proportional. We do not rewrite the entire codebase or invent configuration layers. We update the manifest identity in `package.json`, update the primary documentation and agent playbooks (`README.md`, `AGENTS.md`, `SKILL.md`, `docs/`) to use `browser-nav` / `BROWSER_NAV_*`, and keep legacy references (`pwa-nav`, `PWA_NAV_*`) explicitly documented as supported aliases.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `package.json`: Holds package identity (`name`, `description`, `bin`).
   - `AGENTS.md` and `SKILL.md`: Single operational sources of truth for AI agents (coding assistants).
   - `README.md` and `docs/`: User-facing manuals, guides, and MCP client setup.
3. **DRY via Composition (Principle 3)**: Documentation and instructions must reference the exact same CLI command signatures and MCP server configurations, avoiding divergent examples across files.
4. **Service Layer & Anti-Corruption (Principles 4 & 5)**: Code contracts already established in Spec 028 and 029 remain unchanged: `browser-nav` and `pwa-nav` CLI entrypoints share the unified tool service layer in `src/tools/` without vendor leakage.
5. **Testing Behavior & Hygiene (Principles 6 & 7)**:
   - Add/update behavioral test in `src/cli/test/cli.test.ts` verifying that `package.json` declares `"name": "browser-nav"` and exposes both canonical (`browser-nav`, `bnav`, `browser-nav-mcp`) and legacy (`pwa-nav`, `pwa-nav-mcp`) binaries.
   - Follow Arrange-Act-Assert without conditionals.
   - Run the complete CI verification pipeline (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`).
6. **Follow the Stack's Standards (Principle 8)**: Standard npm package metadata conventions, Markdown GitHub-flavored formatting, and standard MCP client configuration blocks.
7. **Validate with Research (Principle 9)**: Confirmed with npm package specification and MCP client configuration formats (Claude Desktop, Antigravity, Cursor) where `browser-nav-mcp` or `node <path>/dist/mcp.js` is the standard stdio command.
8. **Document Trade-offs (Principle 10)**: Documented below in Decisions.

---

### Decisions

- D1@1 (implements R1): **Canonical Package Manifest Identity in `package.json`**.
  - Update `"name": "browser-nav"`.
  - Update `"description"`: `"CLI + bridge for fluid QA on login-walled web apps (Firefox over W3C WebDriver BiDi, screen maps, MCP)"`.
  - Ensure `"bin"` exports:
    - `"browser-nav": "./dist/cli.js"`
    - `"bnav": "./dist/cli.js"`
    - `"pwa-nav": "./dist/cli.js"`
    - `"browser-nav-mcp": "./dist/mcp.js"`
    - `"pwa-nav-mcp": "./dist/mcp.js"`
  - *Trade-off*: Changing `"name"` in `package.json` from `pwa-nav` to `browser-nav` alters the package identity in package registries and lockfiles.
  - *Mitigation*: The CLI binary aliases (`pwa-nav`, `pwa-nav-mcp`) are preserved in `"bin"`, and local imports inside the repository use relative paths (`./` and `../`), so no internal code imports are broken.

- D2@1 (implements R2, R3): **Convergence of Agent Playbooks & Instructions (`AGENTS.md`, `SKILL.md`)**.
  - Update top-level headers and introductory context to `browser-nav`.
  - Replace all CLI examples: `pwa-nav open` -> `browser-nav open`, `pwa-nav snapshot` -> `browser-nav snapshot`, `pwa-nav click` -> `browser-nav click`, `pwa-nav fill` -> `browser-nav fill`, `pwa-nav act` -> `browser-nav act`, `pwa-nav wait` -> `browser-nav wait`, `pwa-nav journey` -> `browser-nav journey`, `pwa-nav auth` -> `browser-nav auth`.
  - Ensure all environment variable references list `BROWSER_NAV_*` as canonical and `PWA_NAV_*` as backward-compatible fallback.

- D3@1 (implements R2, R3): **Convergence of User Documentation (`README.md`)**.
  - Update title, overview, CLI command usage table, and code snippets to use `browser-nav` (mentioning shorthand `bnav` and legacy `pwa-nav`).
  - Update environment variable reference table to feature `BROWSER_NAV_*` prominently, with fallback column noting `PWA_NAV_*`.
  - Update Quickstart and MCP client setup sections to guide users on configuring `browser-nav-mcp` (or `node dist/mcp.js`).

- D4@1 (implements R4): **Documentation Files Convergence (`docs/mcp.md`, `docs/screen-map.md`, `docs/firefox-runtime.md`)**.
  - In `docs/mcp.md`: Show MCP configuration blocks using `browser-nav-mcp` (or `node dist/mcp.js`), describe `browser_*` and `screen_learn` tools, and document environment variables.
  - In `docs/screen-map.md`: Update CLI commands (`browser-nav snapshot --screen`, `browser-nav snapshot --learn`, `browser-nav journey`).
  - In `docs/firefox-runtime.md`: Update runtime cache paths (`%LOCALAPPDATA%\browser-nav\runtime` or managed paths) and CLI diagnostic commands (`browser-nav runtime status`).

- D5@1 (implements R5): **Behavioral Verification & Package Integration Tests**.
  - In `src/cli/test/cli.test.ts`: Verify that `package.json` contains `"name": "browser-nav"` and correctly maps both `browser-nav`, `bnav`, and `pwa-nav` CLI bins.
  - Execute full validation (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`).

---

## Deliverables

- `package.json`: Updated `name`, `description`, and verified `bin` mappings.
- `AGENTS.md`: Canonical `browser-nav` instructions, CLI examples, and env vars.
- `SKILL.md`: Canonical agent skill reference aligned with `browser-nav`.
- `README.md`: Canonical user-facing documentation and CLI command reference.
- `docs/mcp.md`: Canonical MCP configuration and tool definitions.
- `docs/screen-map.md`: Canonical screen map CLI examples.
- `docs/firefox-runtime.md`: Canonical runtime documentation and commands.
- `src/cli/test/cli.test.ts`: Behavioral tests asserting package name and bin mappings.

---

## Sequencing

1. Update `package.json` package name and description.
2. Update behavioral test in `src/cli/test/cli.test.ts` to assert `"name": "browser-nav"`.
3. Update `AGENTS.md` and `SKILL.md`.
4. Update `README.md` and `docs/` files.
5. Run full test suite and verify clean execution.
