# 027 — mcp-agent-guidance-and-system-prompt — Design

## Approach

Applying the 10 Core Engineering Principles:
1. **KISS / YAGNI (Principle 1)**: Keep all MCP system instructions and tool descriptions as plain, deterministic TypeScript string constants and pure builders inside `src/mcp/mcp-server.ts` and `src/mcp/mcp-tools.ts`. Do not introduce external template engines, prompt loader abstractions, or markdown-to-prompt compilers for a single MCP server.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/mcp/mcp-server.ts`: Owns the MCP initialization handshake and the authoritative system-level `BASE_INSTRUCTIONS` (`buildServerInstructions`) delivered to connecting AI agents.
   - `src/mcp/mcp-tools.ts`: Owns the per-tool `ToolDef` declarations (`description` and `inputSchema` parameter descriptions) for all registered browser automation tools.
   - `docs/mcp.md`, `SKILL.md`, and `AGENTS.md`: Own human- and agent-readable operational documentation kept in sync with the server's live prompt guidance.
3. **DRY via Composition (Principle 3)**: Export a pure function `buildServerInstructions(humanNote?: string): string` (alongside `BASE_INSTRUCTIONS`) in `src/mcp/mcp-server.ts` that composes the base operational guidance with any dynamic human-only flow/journey notes from `humanOnlyNote`, eliminating inline string concatenation inside `createMcpServer` and making instruction assembly directly testable.
4. **Service Layer & Anti-Corruption (Principles 4 & 5)**: Keep instruction formatting and tool metadata strictly in the `src/mcp/` adapter layer; `src/tools/` and `src/core/` remain completely decoupled from MCP prompt phrasing.
5. **Testing Behavior & Hygiene (Principles 6 & 7)**: Write focused behavioral tests in `src/mcp/test/mcp-server.test.ts` following Given-When-Then / Arrange-Act-Assert without conditionals or loops in tests, verifying the exact behavioral contracts of `client.getInstructions()` and `client.listTools()` for R1–R4.
6. **Follow the Stack's Standards (Principle 8)**: Adhere to MCP specification (`InitializeResult.instructions`, `Tool.description`, JSON Schema 2020-12 `property.description`) and TypeScript strict mode.
7. **Validate with Research (Principle 9)**: Validated against Anthropic's MCP & Tool Use engineering guidelines (*Writing effective tools for agents*) and the root-cause findings in `planning/investigation-screen-maps-and-agent-behavior.md`:
   - Frontier LLMs treat broad negative commands in entry-point tools (like `"Do NOT call pwa_open to perform searches or browse"`) as hard prohibitions against using the entire toolset for web tasks.
   - Positive affordances paired with targeted boundary guidance (e.g., *"Use `pwa_open` to navigate to a new website, URL, domain, or app; to type into a search box on the currently loaded page, use `pwa_fill` and `pwa_click` instead"*) prevent both tool abandonment and URL-bar search misuse.
   - Authoritative MCP `instructions` explaining *why* native tools must be used over ad-hoc Python/Playwright/Selenium scripts (authentic user session + Cloudflare/CAPTCHA/bot-wall immunity) stop agents from falling back to shell script generation.

### Decisions

- D1@1 (implements R1): **Welcoming, Positive-First `pwa_open` Description and Parameter Docs**. In `src/mcp/mcp-tools.ts`, rewrite `open.description` and `open.inputSchema.properties.url.description` to welcome general web navigation and browsing:
  1. Remove the prohibitive phrase `"CRITICAL: The user's PWA is already open and loaded with their app. Do NOT call pwa_open to perform searches or browse."`
  2. State clearly that `pwa_open` navigates the active browser window to any target website, full HTTP(S) URL, domain (e.g. `'linkedin.com'`, `'github.com'`), or registered app alias (e.g. `'notebook'`, `'linkedin'`, `'mercadona'`), launching or attaching to the user's authenticated browser profile automatically.
  3. Frame in-page search positively: explain that `pwa_open` is for navigating to a URL/domain/app, whereas typing search queries into an already-open page's search bar is done via `pwa_fill` + `pwa_click` (or `pwa_act`) after `pwa_snapshot`.
- D2@1 (implements R2, R3): **Authoritative Browser-First & Anti-Bot System Instructions (`BASE_INSTRUCTIONS` / `buildServerInstructions`)**. In `src/mcp/mcp-server.ts`, export `BASE_INSTRUCTIONS` and a pure helper `buildServerInstructions(humanNote?: string): string` used in the MCP `Server` initialization handshake:
  1. **Primary Web Automation Capability (R2)**: Open `BASE_INSTRUCTIONS` by stating clearly that `pwa-nav` is the agent's primary web browsing and browser automation capability, attaching directly to the user's real, authenticated Firefox browser instance (preserving active logins, cookies, and sessions across websites and web apps).
  2. **Explicit Anti-Bot Warning Against Synthetic Scripts (R3)**: Explicitly instruct the agent **NEVER** to write or execute ad-hoc Python, Playwright, Puppeteer, Selenium, `requests`, or `curl` scripts for web browsing or scraping, because synthetic headless/bot drivers lack the user's authenticated profile and will immediately trigger anti-bot defenses (Cloudflare, CAPTCHAs, login walls, and 403 blocks). Native `pwa_*` MCP tools must always be prioritized for all web tasks.
  3. **Consistent Numbered Operational Rules**: Fix the out-of-order rule numbering in `BASE_INSTRUCTIONS` (currently `1..8, 10, 9`) to a clean, sequential `1..10` list covering text-first snapshots, autonomous screen map learning (`pwa_learn`), in-app execution, `pwa_wait` over arbitrary sleeps, `pwa_fill`/`pwa_act` for forms, flows/journeys, sensitive target safety, `pwa_find` for locating controls, valid `pwa_open` targets, and zero shell/process inspection loops.
- D3@1 (implements R4): **Browser-General, Unambiguous Tool & Parameter Descriptions Across `TOOLS`**. In `src/mcp/mcp-tools.ts` (and `docs/mcp.md`, `SKILL.md`), audit and refine the `description` and `inputSchema` property descriptions of every tool (`pwa_open`, `pwa_snapshot`, `pwa_click`, `pwa_fill`, `pwa_upload`, `pwa_download`, `pwa_screenshot`, `pwa_extract`, `pwa_find`, `pwa_act`, `pwa_learn`, `pwa_wait`, `pwa_auth`, `pwa_discover`, `pwa_config`, `pwa_install_runtime`) so that:
  1. Every tool clearly states its role in direct live browser automation on any website or web app—eliminating phrasing that implies the tool only works on pre-installed desktop PWAs (e.g., replacing `"Inspect the active PWA window"` with `"Inspect the active browser window"`, and clarifying `app` / `url` parameters apply to any website domain, URL, or app slug).
  2. Each tool's relation to the workflow is explicit (`pwa_open` for navigating to URLs/domains/apps; `pwa_snapshot` for text-first DOM/accessibility inspection; `pwa_find` for locating interactive elements and modal controls; `pwa_fill` / `pwa_click` / `pwa_act` for interacting with page inputs and buttons; `pwa_learn` for persisting `.agent/apps/<appSlug>/screens.json`; `pwa_wait` for async DOM state changes).

## Trade-offs & Mitigations (Principle 10)

- **Decision 1: Removing `"Do NOT call pwa_open to perform searches or browse"` vs preventing agents from passing raw search queries into `pwa_open({ url })`.**
  - *Pros*: Eliminates the #1 root cause of autonomous agents abandoning `pwa-nav` tools in favor of Python/Playwright when asked to browse or research on the web.
  - *Cons*: Without a boundary reminder, an agent might try calling `pwa_open({ url: "best wireless headphones" })` instead of navigating to a site or using an in-page search input.
  - *Mitigation*: Keep the positive boundary guidance in both `open.description` and `open.inputSchema.properties.url.description` (*"Pass a full URL, domain (e.g. 'linkedin.com'), or app alias—not a free-text search query; to search inside a page, fill its search box with `pwa_fill`"*), backed by the existing fail-fast validator in `resolveTargetUrl` (`src/core/url-resolver.ts`) which deterministically rejects bare words with `invalid_args` and a helpful hint.
- **Decision 2: Comprehensive system instructions in MCP handshake vs token budget.**
  - *Pros*: Guarantees every MCP-compliant client receives the anti-bot warning (R3) and operational rules (R2) at connection time, even if the user's workspace does not load `AGENTS.md` or `SKILL.md`.
  - *Cons*: Overly verbose `instructions` consume system prompt tokens on every conversation.
  - *Mitigation*: Keep `BASE_INSTRUCTIONS` high-signal, structured into concise numbered rules (~600 tokens total), avoiding duplicate paragraphs while covering all required invariants.
- **Decision 3: Updating tool descriptions in Spec 027 before canonical renaming in Spec 028.**
  - *Pros*: Spec 027 cleanly isolates and verifies the prompt/description content improvements (R1–R4) without mixing them with the namespace/alias routing changes in Spec 028 (SRP).
  - *Cons*: Tool names in Spec 027 still use `pwa_*` until Spec 028 introduces `browser_*` canonical names and legacy `pwa_*` aliases.
  - *Mitigation*: Write the descriptions in `src/mcp/mcp-tools.ts` as clean, self-contained definitions so Spec 028 can reuse the exact same descriptions and handlers when registering `browser_*` canonical tools and `pwa_*` aliases.

## Deliverables

- `src/mcp/mcp-server.ts`: Export `BASE_INSTRUCTIONS` and `buildServerInstructions(humanNote?: string): string` with the updated browser-first identity (R2), anti-bot warning against synthetic Python/Playwright/Selenium scripts (R3), and sequential operational rules.
- `src/mcp/mcp-tools.ts`: Update `open` and all tool `description` and `inputSchema` property descriptions to be welcoming for general web navigation (R1) and unambiguous regarding live browser automation vs installed PWAs (R4).
- `src/mcp/test/mcp-server.test.ts`: Unit and integration tests verifying R1, R2, R3, and R4 over the MCP client-server handshake and `tools/list`.
- `docs/mcp.md` & `SKILL.md`: Synchronize documentation with the updated tool descriptions and system prompt rules.

## Sequencing

1. Update `BASE_INSTRUCTIONS` and extract `buildServerInstructions` in `src/mcp/mcp-server.ts` to fulfill R2 and R3.
2. Update `pwa_open` and all tool descriptions and parameter docs in `src/mcp/mcp-tools.ts` to fulfill R1 and R4, and sync `docs/mcp.md` and `SKILL.md`.
3. Add behavioral tests in `src/mcp/test/mcp-server.test.ts` verifying R1, R2, R3, and R4.
4. Run full CI verification (`pnpm lint && pnpm build && pnpm test && pnpm smoke`) and `python .spectrace/trace.py check`.
