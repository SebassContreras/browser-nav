# Product Vision & Scope

This document defines the product purpose, target audience, core user problems, and functional boundaries. AI agents must consult it to understand the *why* and *what* before proposing features or modifying scope.

---

## 1. Value Proposition & Vision

`browser-nav` (historically `pwa-nav`, CLI shorthand `bnav`) is a stable CLI + MCP bridge for fluid QA of web applications and lawful, assisted browsing automation on login-walled sites where classic bots (Playwright, Puppeteer, Selenium with Chromium) are blocked by Cloudflare, CAPTCHAs, or anti-bot defenses — including Google NotebookLM, Mercadona, LinkedIn, and internal enterprise web applications.

Instead of injecting synthetic bot drivers or handling user credentials, `browser-nav` attaches to the user's own, already-logged-in **Firefox** (standalone Firefox PWA runtime or existing profile) over the standard W3C WebDriver BiDi loopback protocol (`--remote-debugging-port 9222`).

---

## 2. Target Audience & Personas

- **Solo developers and dev teams** running QA against their own login-walled apps.
- **QA engineers** capturing deterministic test evidence.
- **Autonomous AI coding agents** pair-programming with users through the CLI or MCP tools.

---

## 3. Core Problems Solved

| Problem | How This Product Solves It |
|---|---|
| Bot drivers are blocked by anti-bot walls | Drives the user's real, logged-in Firefox over W3C WebDriver BiDi |
| Agents burn tokens re-reading full pages | Per-app screen maps with compact views (~86% token reduction) and stable `@id` targets |
| Agents can cause harm with live input | Multi-layer safety gate: dry-run, origin allow-list, kill-switch, sensitive-field barrier, upload path boundary |
| Screenshots flood LLM context | Evidence saved to disk; only `{path, width, height}` is reported |

---

## 4. Key Functional Capabilities

1. **Dual navigation layers:**
   - *Fast semantic loop*: per-app screen maps (`.agent/apps/<appSlug>/screens.json`) with compact views, dynamic screen learning (`snapshot --learn`, `screen_learn`), parameterized single-screen flows, and multi-screen declarative user journeys (`journey`) with network/DOM settling and destination assertions.
   - *Raw accessibility loop*: ephemeral snapshot trees targeting refs (`e1`, `e2`, …) with strict single-mutation invalidation.
2. **Write actions behind a safety gate:** click, fill, batch acts, and local file uploads, gated by dry-run/armed modes, origin allow-list, kill-switch, sensitive-field barriers, and safe upload paths.
3. **Visual QA evidence with context economy:** screenshots and `qa run` evidence saved to `.agent/screenshot.png` and `.agent/evidence/<run-id>/`, never base64 into context.
4. **Cross-platform runtime:** discovery and direct launch on Windows (`%APPDATA%\FirefoxPWA`), Linux (XDG, Flatpak, system fallbacks), and macOS (`Application Support`, app bundle).
5. **Dual client interfaces:** CLI (`browser-nav` / `bnav` / `pwa-nav`) and stdio MCP server (`browser-nav-mcp`) with dynamic flow and journey tools.

---

## 5. Non-Goals & Boundaries

- Any bot evasion, CAPTCHA bypass, or credential scraping. Credentials remain strictly in the user's custody.
- Headless credential-based login.
- Custom WebSocket bridge server (v2).
- Native WebMCP (`document.modelContext`) tools (v2).
- Multi-session management and dashboard UI (v2).
- Still to define: PWA SDK shape (v2 custom bridge); notebook adapter beyond text extract (post-MVP).

---

## Docs

| Doc | Describes |
|---|---|
| `README.md` | What it is, install, usage, commands, exit codes |
| `AGENTS.md` | How agents work in this repo (commands, workflow, pointers) |
| `SKILL.md` | One-page operational playbook for agents driving the CLI or MCP tools |
| `PRODUCT.md` | Vision, audience, capabilities, non-goals |
| `ARCHITECTURE.md` | Topology, stack, layers, directory map, MCP flags |
| `ENGINEERING.md` | Code principles and hard rules |
| `DESIGN.md` | CLI conventions, output formats, error codes, editorial tone |
| `TESTING.md` | Test invariants, hygiene, and verification commands |
| `CHANGES.md` | Ledger of pivots and replaced decisions |
| `planning/roadmap.md` | Specs in order, status, and ideas |
| `docs/operations.md` | Agent navigation workflows and full safety rules |
| `docs/firefox-runtime.md` | Firefox discovery, launch flags, troubleshooting |
| `docs/screen-map.md` | Screen map schema, route matching, compact view, journeys |
| `docs/mcp.md` | MCP stdio server setup, tool registry, resources, client config |
| `docs/notebook-pilot.md` | NotebookLM pilot notes |
