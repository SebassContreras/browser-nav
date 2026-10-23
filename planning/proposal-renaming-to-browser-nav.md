# Architecture Proposal: Renaming from `pwa-nav` to `browser-nav` & Tool Re-aliasing

**Document ID**: `planning/proposal-renaming-to-browser-nav.md`  
**Date**: 2026-10-23  
**Status**: Proposal & Discussion  
**Target Audience**: Developers, Tool Integrators, Agent Harness Authors  

---

## 1. Context & Motivation

### 1.1 The Historical Legacy of "PWA"
The project was originally conceived to interface with Firefox Progressive Web Apps (historically exploring integration with the `pwas-for-firefox` native extension). 

However, architectural evolution through Specs 004–023 radically transformed the system:
1. **Zero Extensions & Zero "Installed" Apps**: The extension was completely retired. The project does not "install" desktop PWAs in the OS or package standalone web apps with desktop manifests.
2. **Authentic Browser Automation Over W3C WebDriver BiDi**: The engine simply attaches to or spawns an authentic **Mozilla Firefox** browser instance over W3C WebDriver BiDi loopback port `9222`, utilizing standalone Firefox profiles or the user's authentic logged-in profiles.
3. **General Web Capability**: The tool can navigate to any arbitrary web origin, domain, or authenticated web app (e.g. LinkedIn, Mercadona, Google NotebookLM, GitHub, enterprise intranets) without requiring the target site to be a PWA.

### 1.2 Cognitive Friction for Autonomous AI Agents
When LLMs (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro) inspect available tools in an MCP catalog:
* The prefix **`pwa_*`** triggers a semantic association with local desktop-packaged PWAs.
* When given standard browsing tasks (*"Open LinkedIn and find messages"*, *"Check prices on Mercadona"*), the LLM infers that `pwa_*` tools are unsuitable for general web surfing or navigating normal websites.
* Consequently, the agent rejects `pwa_*` tools and defaults to writing synthetic Python automation scripts (`import playwright`, `import selenium`).

### 1.3 The Power of the `browser_*` Semantic Standard
Across the Model Context Protocol (MCP) ecosystem and autonomous agent frameworks, **`browser_*`** is the established golden standard for web automation (e.g., Puppeteer MCP, Playwright MCP, Stagehand). 

When an agent sees tools named `browser_open`, `browser_click`, `browser_fill`, and `browser_snapshot`, it recognizes them immediately as its primary web automation engine and executes in-browser tasks without writing external code.

---

## 2. Proposed Nomenclature Changes

### 2.1 MCP Tool Registry Mapping

To eliminate cognitive friction while preserving backward compatibility, tools will transition to the `browser_*` / `screen_*` namespace. Existing `pwa_*` names will be maintained as transparent legacy aliases.

| Current MCP Tool (`pwa_*`) | Proposed Canonical Name | Role / Functionality Description | Agent Cognitive Alignment |
|---|---|---|---|
| `pwa_open` | **`browser_open`** *(or `browser_navigate`)* | Navigate active browser window to URL/domain/app slug. | Eliminates the perception that apps must be pre-installed. |
| `pwa_snapshot` | **`browser_snapshot`** | Inspect active page DOM and accessibility tree in pure text. | Matches agent expectations for DOM state inspection. |
| `pwa_click` | **`browser_click`** | Click buttons, links, or tabs by semantic target or ref. | Direct browser interaction primitive. |
| `pwa_fill` | **`browser_fill`** *(or `browser_type`)* | Type text into inputs, textareas, and search boxes. | Direct typing primitive. |
| `pwa_find` | **`browser_find`** | Search interactive controls, placeholders, or modal dialogs. | Primary element discovery primitive. |
| `pwa_act` | **`browser_act`** | Execute multiple ordered actions in a single atomic BiDi turn. | Atomic action chaining. |
| `pwa_wait` | **`browser_wait`** | Await asynchronous UI updates or background processing. | Async settlement primitive. |
| `pwa_download` | **`browser_download`** | Download remote assets or extract in-page media. | Media acquisition primitive. |
| `pwa_upload` | **`browser_upload`** | Upload local safe files to file inputs. | Form attachment primitive. |
| `pwa_screenshot` | **`browser_screenshot`** | Visual screenshot (restricted to explicit user requests). | Visual capture primitive. |
| `pwa_auth` | **`browser_auth`** | Assisted authentication workflow & session health check. | Login/cookie management primitive. |
| `pwa_config` | **`browser_config`** | Inspect/update runtime storage paths during active session. | Session configuration primitive. |
| `pwa_install_runtime`| **`browser_install_runtime`** | Managed download of official Firefox runtime. | Runtime acquisition primitive. |
| `pwa_discover` | **`browser_discover`** | History route discovery from SQLite profile. | Route inspection primitive. |
| `pwa_learn` | **`screen_learn`** *(or `browser_learn_screen`)* | Learn and register structural screen into screen map. | Distinct domain boundary for screen mapping. |

---

### 2.2 CLI Binary & Commands

| Component | Current Name | Proposed Name | Backward Compatibility |
|---|---|---|---|
| CLI Command | `pwa-nav` | **`browser-nav`** *(alias: `bnav`)* | Symlink / alias `pwa-nav` retained in `package.json` `bin`. |
| MCP Server Entry | `pwa-nav-mcp` | **`browser-nav-mcp`** | Both bin targets exported in `package.json`. |
| Server Description | `"pwa-nav"` | `"browser-nav (Firefox WebDriver BiDi bridge)"` | Clarifies real browser backing in MCP handshake. |

---

### 2.3 Environment Variables & Global Storage

To ensure non-breaking transitions, the system will support dual resolution (checking new variable first, falling back to legacy variable):

| Scope | Proposed Variable | Legacy Fallback |
|---|---|---|
| BiDi Port | `BROWSER_NAV_PORT` | `PWA_NAV_PORT` |
| Cache Directory | `BROWSER_NAV_CACHE_DIR` | `PWA_NAV_CACHE_DIR` |
| Screens Directory | `BROWSER_NAV_SCREENS_DIR` | `PWA_NAV_SCREENS_DIR` |
| Dry Run Mode | `BROWSER_NAV_DRY_RUN` | `PWA_NAV_DRY_RUN` |
| Kill Switch | `BROWSER_NAV_KILL_SWITCH` | `PWA_NAV_KILL_SWITCH` |
| Global Home Fallback | `~/.browser-nav` | `~/.pwa-nav` (migrated if present) |

---

## 3. Backward Compatibility Strategy

A sudden breaking change would break existing user setups, MCP client configs (`claude_desktop_config.json`, Cursor MCP, Antigravity harnesses), and integration test suites.

### 3.1 Transparent MCP Alias Architecture
In `src/mcp/mcp-server.ts`:
1. **Primary Tool Manifest**: The `ListTools` RPC exposes `browser_*` tools as the canonical interface to the LLM.
2. **Dynamic Inbound Dispatching**: In `CallTool`, requests targeting `pwa_<action>` are automatically routed to the handler for `browser_<action>`.
3. **Zero Deprecation Friction**: Older agent prompts or scripts calling `pwa_click` or `pwa_open` continue to execute flawlessly without error.

```typescript
// Conceptual mapping in mcp-server dispatch:
const resolvedName = request.params.name.replace(/^pwa_/, "browser_");
const entry = compiled.get(resolvedName) ?? compiled.get(request.params.name);
```

### 3.2 Dual CLI Bins
In `package.json`:
```json
{
  "bin": {
    "browser-nav": "./dist/cli.js",
    "bnav": "./dist/cli.js",
    "pwa-nav": "./dist/cli.js",
    "browser-nav-mcp": "./dist/mcp.js",
    "pwa-nav-mcp": "./dist/mcp.js"
  }
}
```

---

## 4. MCP System Instructions & Prompt Refactoring

Alongside the tool renaming, the system instructions emitted during the MCP handshake (`instructions` in `new Server()`) will be updated to explicitly establish the browser's identity and preempt synthetic scripting:

### Key Instructions Enhancements:
1. **Establish Identity as the Primary Web Browser**:
   > *"browser-nav attaches directly to an authentic Mozilla Firefox browser instance over W3C WebDriver BiDi. It is the agent's primary and authoritative web automation tool for navigating websites, researching online, and interacting with authenticated web applications."*
2. **Explicit Prohibition of Synthetic Python Scripts**:
   > *"NEVER attempt to create or execute Python, Selenium, Playwright, or Puppeteer scripts to browse the web or scrape pages. Synthetic bot drivers are detected and blocked by Cloudflare, CAPTCHAs, and enterprise bot defenses. Always use the browser_* tools directly, which run inside an authentic human browser session with active authentication."*
3. **Clear Navigation Guidance**:
   > *"To browse to any website, domain, or web application, call browser_open(url: 'https://...'). Then use browser_snapshot() or browser_find() to inspect interactive elements."*

---

## 5. Implementation Roadmap

### Phase 1: Tool Registry Dual Registration & Alias Support
* Update `src/tools/` and `src/mcp/mcp-tools.ts` to declare `browser_*` tools as primary.
* Add transparent alias routing for inbound `pwa_*` requests.
* Revise `mcp-server.ts` system prompt to emphasize the primary browser role.

### Phase 2: CLI Binary Aliases & Environment Fallbacks
* Export `browser-nav` and `bnav` alongside `pwa-nav` in `package.json`.
* Update `src/core/storage.ts` to accept `BROWSER_NAV_*` environment variables with fallback to `PWA_NAV_*`.

### Phase 3: Documentation & Skill Updates
* Update `README.md`, `SKILL.md`, and `docs/mcp.md` to reflect `browser_*` conventions.
* Add migration guide for existing MCP server client configurations.

---

## 6. Decision & Review Questions

Before executing the implementation:
1. **Binary Name Preference**: Does the team prefer `browser-nav` (generic, clear), `firefox-nav` (highlighting Firefox anti-bot defense), or `bnav` as the primary bin?
2. **Screen Learn Tooling**: Should screen learning be named `browser_learn` or `screen_learn` to demarcate the screen-mapping domain from raw browser actions?
3. **Repository Name**: Should the GitHub repository name be renamed in tandem, or remain `pwa-nav` with `browser-nav` as the package/tool identity?
