# Investigation & Root Cause Analysis: Agent Navigation, Screen Map Storage, and Dynamic Element Noise

**Document ID**: `planning/investigation-screen-maps-and-agent-behavior.md`  
**Date**: 2026-10-23  
**Status**: Discovery & Hypothesis Phase (No solutions proposed)  
**Scope**: MCP Tool Adoption, Screen Persistence Mechanics, and Semantic Screen Pollution  

---

## Executive Summary

During live usage of `pwa-nav` across authenticated, complex web applications (e.g., LinkedIn, messaging workflows, enterprise feeds), three structural dysfunctions have been identified:

1. **Autonomous Agent Reluctance & Tool Abandonment**: An autonomous agent tasked with web navigation chose to write custom Python scripts (Playwright/Selenium/Requests) rather than invoking `pwa_*` tools.
2. **Screen Map Persistence Disconnect & Storage Partitioning**: Screen maps are perceived as failing to save or not persisting into the expected locations per application.
3. **Screen Map Pollution with Ephemeral and Dynamic Noise**: The generated screen maps capture transient UI elements (chat messages, anonymous checkboxes, time-decayed feed headlines, reaction buttons, unparameterized message threads), generating hundreds of volatile targets that break navigation and pollute the application's permanent architecture.

This document explores exhaustive hypotheses and technical root causes behind each of these three phenomena without proposing premature solutions.

---

## 1. Problem Statement 1: Why Autonomous Agents Choose Python Scripts Over `pwa-nav` MCP Tools

### Symptom
When an autonomous AI agent is given a browsing or navigation task on a target website, the agent ignores the registered `pwa_*` MCP tools and instead writes, tests, and executes ad-hoc Python automation scripts.

### Hypotheses & Deep Root Cause Analysis

#### Hypothesis 1.1: Prohibitive & Intimidating Tool Descriptions in MCP Registry
* **Observation**: In `src/mcp/mcp-tools.ts`, the description of `pwa_open` states:
  > `"Navigate the PWA window to a new URL. CRITICAL: The user's PWA is already open and loaded with their app. Do NOT call pwa_open to perform searches or browse. To search or interact within the app, use pwa_snapshot first to inspect the page..."`
* **Causal Factor**: Frontier LLMs (Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro) adhere strictly to negative constraints. When a tool description explicitly warns: `"Do NOT call pwa_open to perform searches or browse"`, the agent interprets `pwa_open` as forbidden for general web navigation or exploratory browsing. The agent infers that `pwa-nav` is strictly an in-situ inspector for an already opened window, forcing it to look elsewhere for browsing capabilities.

#### Hypothesis 1.2: Semantic Bias of the "PWA" Acronym
* **Observation**: The entire tool suite uses the prefix `pwa_` (`pwa_open`, `pwa_click`, `pwa_fill`, `pwa_act`).
* **Causal Factor**: Pre-training datasets strongly associate the term "PWA" (Progressive Web App) with local web applications installed on an OS desktop or mobile device. When a user requests: *"Go to LinkedIn and check my messages"*, the LLM's semantic classifier distinguishes between a "general website" and an "installed PWA". If the user did not explicitly frame the task as managing an installed PWA, the agent concludes that `pwa_*` tools are the wrong toolset for normal web browsing.

#### Hypothesis 1.3: Training Bias Towards Synthetic Browser Drivers (Playwright/Selenium/BeautifulSoup)
* **Observation**: LLMs have ingested millions of GitHub repositories and StackOverflow threads where web automation is solved via `from playwright.sync_api import sync_playwright` or `import requests`.
* **Causal Factor**: Standard autonomous agents have a default behavioral pattern: if a custom domain tool seems specialized or unfamiliar, they default to what has the highest probability distribution in their training weights (writing a Python script). Unless the MCP server provides an authoritative system instruction stating that synthetic scripts *will fail* due to bot defenses, the agent will predictably revert to Python.

#### Hypothesis 1.4: Asymmetric Tool Signature Complexity
* **Observation**: `pwa_open` accepts parameters: `url`, `launch`, `allowOrigin`, `cacheDir`, `workspaceDir`. Interacting with elements requires understanding concepts like `snapshotId`, `ref`, semantic `@id`, or accessibility tree collectors.
* **Causal Factor**: Writing a 5-line Python script that imports Playwright and calls `page.goto()` appears to the agent as a lower cognitive overhead path with fewer protocol steps, especially if it does not anticipate Cloudflare or authentication barriers.

#### Hypothesis 1.5: Failure-Induced Tool Rejection (Fallback Cascades)
* **Observation**: If an agent attempts an initial tool call (e.g. `pwa_open`) and receives an error such as `no_browser` (exit code 4), `origin_blocked` (exit code 6), or `invalid_args` (exit code 2), standard agent harnesses treat the tool as malfunctioning or offline.
* **Causal Factor**: Rather than diagnosing the tool's expected lifecycle (e.g. launching with `--remote-debugging-port 9222` or provisioning an origin), agentic harnesses fall back to shell execution (`run_command`) to write their own autonomous scripts.

---

## 2. Problem Statement 2: Why Screen Maps Fail to Save or Cannot Be Located

### Symptom
Users and agents observe that screen maps are not being saved where expected, appear missing after execution, or fail to resolve across consecutive snapshot/learn calls.

### Hypotheses & Deep Root Cause Analysis

#### Hypothesis 2.1: Architectural Divergence in Screen Map Persistence Paths
* **Observation**:
  * In `src/tools/learn.ts`:
    ```typescript
    const dir = dirOf(o, backend.agentDir); // resolves to <agentDir>/screens
    path = join(dir, `${appId}.screens.json`);
    ```
  * In `src/ops/ops.ts` (`autoCollaborateScreen`):
    ```typescript
    const appDir = join(backend.agentDir, "apps", appId);
    screenMapPath = join(appDir, "screens.json");
    ```
  * In `src/tools/snapshot.ts`:
    ```typescript
    const slug = appSlugFromUrl(snap.url);
    const screenMapPath = join(backend.agentDir, "apps", slug, "screens.json");
    ```
* **Causal Factor**: There are two competing storage philosophies currently coexisting in the codebase:
  1. The legacy/centralized screen directory model: `.agent/screens/<appId>.screens.json`.
  2. The per-app profile isolation model: `.agent/apps/<appSlug>/screens.json`.
  When a user runs `pwa_learn`, the file is written to `.agent/screens/`. When `pwa_snapshot` executes auto-collaboration, it checks `.agent/apps/<appSlug>/screens.json`. This causes the agent and user to look in the wrong directory, believing the map was never generated.

#### Hypothesis 2.2: Discrepancy in Application Slug Derivation
* **Observation**:
  * In `src/backend/backend.ts`, `appSlugFromUrl(url)` strips `www.` and applies regex:
    `u.hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()`. For `https://www.linkedin.com`, this yields `"linkedin-com"`.
  * In `src/screens/screen-learn.ts` and `src/tools/learn.ts`:
    `slugify(`${page.hostname}${page.port === "" ? "" : `-${page.port}`}`)`. For `www.linkedin.com`, this yields `"www-linkedin-com"`.
* **Causal Factor**: If one subsystem saves to `.agent/apps/www-linkedin-com/screens.json` while another looks for `.agent/apps/linkedin-com/screens.json`, the application map will be completely invisible to subsequent operations, triggering `unmapped_screen` (exit code 13) repeatedly.

#### Hypothesis 2.3: Multi-Map Origin Collisions in Directory Scans
* **Observation**: In `src/screens/screen-match.ts`, `loadScreenMapsFromDir` scans both `<agentDir>/screens` and `<agentDir>/apps`. If both paths contain a map covering origin `https://www.linkedin.com`, `selectMap` throws:
  > `"several screen maps cover origin https://www.linkedin.com: ... keep one map per origin"`.
* **Causal Factor**: Once an app has been partially learned in both locations, any subsequent command fails fast with `invalid_args`, preventing any new screen updates from writing to disk.

#### Hypothesis 2.4: Workspace vs. Global Data Directory Mismatch (Dynamic Workspace Handshake)
* **Observation**: In `src/core/storage.ts`, storage resolves through `resolveAgentDir`. If the MCP client does not send `workspaceFolders` or `rootUri` in its initialization RPC, `resolveAgentDir` falls back to `~/.pwa-nav`.
* **Causal Factor**: The screen maps are physically written to `C:\Users\<user>\.pwa-nav\apps\...`, while the user and agent are inspecting the repository workspace at `<workspaceRoot>\.agent\apps\...`. To the user inspecting their project folder, the files appear not to be saving at all.

#### Hypothesis 2.5: Deep Equality Gate Suppressing Disk Writes
* **Observation**: In `src/screens/screen-store.ts`:
  ```typescript
  const written = existing === undefined || !isDeepStrictEqual(map, existing);
  if (written) {
    await writeScreenMap(input.path, map);
  }
  ```
* **Causal Factor**: If elements on the page were already recorded or if volatile fields drift without altering the structural JSON equality after normalization, `written` evaluates to `false`. The log outputs `(unchanged)`, which can be misinterpreted by an agent as a failure to persist new screen state.

---

## 3. Problem Statement 3: Dynamic Elements, Ephemeral Noise, and Screen Pollution

### Symptom
The generated screen maps capture non-functional, transient, and high-frequency content (e.g. chat messages, specific user names, reaction emojis, anonymous list checkboxes, news articles, and volatile notification badges). Furthermore, every unique chat thread creates a separate, duplicated screen object.

### Hypotheses & Deep Root Cause Analysis

#### Hypothesis 3.1: Absolute Lack of Route Normalization & Dynamic Param Detection
* **Observation**: In the user's provided LinkedIn map:
  * `/messaging/thread/2-ZjhmMGE2NDUtNjM0OS00ZGE3LWE3YTItMjBiZmVhNWYyNWY2XzEwMA==/`
  * `/messaging/thread/2-ODBiM2EzMDItMDQ4OC00MTA5LTkyZGMtZDMxZWYzNWUzY2RjXzEwMA==/`
  * `/messaging/thread/2-MDY0MjBjMDUtYzllMy00N2JhLWIwODMtYmJlZGUyZGFjOGJhXzEwMA==/`
  * `/messaging/thread/2-MTM4ZDY3NTUtMDJkOS00ZjM0LWJhMjAtNDdkM2Y3ODAyODQwXzEwMA==/`
* **Code Trace**: In `src/screens/screen-learn.ts`:
  ```typescript
  const route = new URL(page.url).pathname;
  ```
  The learner uses the raw `pathname` without any dynamic pattern substitution.
* **Causal Factor**: Modern SPAs encode entity IDs, UUIDs, Base64 tokens, or slug strings directly in route segments. `screen-learn.ts` explicitly avoids parameter inference (`// Params are NOT inferred`). Consequently, navigating through 10 chat conversations registers 10 separate screens in `screens[]`, duplicating identical UI layouts while preserving ephemeral conversation metadata.

#### Hypothesis 3.2: Fragile Heuristics for Dynamic Container Roles
* **Observation**: `DYNAMIC_CONTAINER_ROLES` in `screen-learn.ts` is hardcoded as:
  ```typescript
  const DYNAMIC_CONTAINER_ROLES = new Set(["feed", "log", "article"]);
  ```
* **Causal Factor**: Production enterprise web applications (LinkedIn, Gmail, Jira) rarely use pure WAI-ARIA `role="feed"` or `role="article"` on internal chat threads or notification flyouts. They construct dynamic feeds using generic `<div>`, `<ul>`, or custom web components. Because the collector does not recognize these as `DYNAMIC_CONTAINER_ROLES`, their children are treated as permanent, static buttons and inputs.

#### Hypothesis 3.3: Inadequate Filtering of Content-Named Interaction Controls
* **Observation**: The captured map contains targets like:
  * `@felicidades-2` (`role: "checkbox"`, `name: "¡Felicidades! 🎉"`)
  * `@me-alegro-mucho-por-ti-2` (`role: "checkbox"`, `name: "🎉 Me alegro mucho por ti"`)
  * `@abre-la-lista-de-opciones-en-tu-conversacion-con-xavi-pin-y-sebastian-contreras`
  * `@sebastian-contreras-pdf-44-kb-descargar`
* **Code Trace**: In `screen-learn.ts`:
  * `isProse()` only drops elements if `nameSource === "content"`, `words >= 5`, and ends with sentence punctuation (`[.!?…]$`).
  * `isTransientName()` only checks prefixes: `"reaction"`, `"view reactions"`, `"quoted message"`, `"reaccion"`, `"ver reacciones"`, `"mensaje citado"`.
* **Causal Factor**:
  1. Quick-reaction buttons (`¡Felicidades! 🎉`) do not end in sentence periods or match the English/Spanish prefix list.
  2. Interactive options on chat messages incorporate dynamic participant names (`"...con Xavi Pin y Sebastian Contreras"`).
  3. Inline document download buttons incorporate filename and file size (`"Sebastian-Contreras.pdf 44 KB Descargar"`).
  None of these meet the strict criteria of `isProse` or `isTransientName`, so they are permanently added as semantic `@id` targets.

#### Hypothesis 3.4: Volatile Badge Counters Bound to Accessible Names
* **Observation**: The captured screen contains targets such as:
  * `@notificaciones-3-notificaciones-nuevas`
  * `@notificaciones-0-notificaciones-nuevas`
  * `@habra-motores-de-combustion-en-la-ue-mas-alla-de-2035-hace-3-horas-377-lectores`
  * `@habra-motores-de-combustion-en-la-ue-mas-alla-de-2035-hace-4-horas-383-lectores`
* **Causal Factor**:
  * Unread notification counts and live reader counts are embedded into the element's accessible name (`aria-label` or inner text).
  * Because the learner computes semantic IDs via `slugify(name)`, any change in counter state (e.g. from 3 unread to 0 unread, or 377 readers to 383 readers) produces an entirely new ID.
  * Over time, the screen map accumulates dozens of zombie targets for the same underlying navigation link.

#### Hypothesis 3.5: Anonymous Checkboxes in Virtualized Message Lists
* **Observation**: The screen captures `@checkbox-1` through `@checkbox-10` with `name: ""` and `nameSource: "content"`.
* **Causal Factor**: LinkedIn's messaging interface renders hidden or visible batch-selection checkboxes alongside each message. Because these checkboxes have no accessible labels, `deriveIds` assigns sequential numbers (`checkbox-1`, `checkbox-2`). These checkboxes only correspond to whatever messages happen to be loaded in the viewport at that specific second, providing zero permanent semantic utility.

#### Hypothesis 3.6: External Content Links Treated as App Navigational Architecture
* **Observation**: The screen map records external links shared in chat messages:
  * `@https-drive-google-com-file-d-1awmdsn-bve4dsfr4gdgkqr5m8omd1zgt-view-usp-drive-link`
  * `@https-meet-google-com-dyf-auqr-fgf`
* **Code Trace**: In `classifyHref`:
  ```typescript
  if (resolved.origin === new URL(appOrigin).origin) {
    return { href, external: false };
  }
  return { href: resolved.origin, external: true };
  ```
* **Causal Factor**: Any `<a>` tag with an `href` inside a message is currently collected. If a user pastes a Google Meet or Google Drive link into a conversation, that unique URL is slugified and recorded into the screen map as a permanent link of the application.

#### Hypothesis 3.7: Conceptual Conflation of "DOM Snapshot" and "Screen Map"
* **Causal Factor**: There is a fundamental architectural tension:
  * A **DOM Snapshot** (`snapshot.json`) represents the literal, momentary state of the viewport right now, including chat messages, counters, and feeds.
  * A **Screen Map** (`screens.json`) represents the permanent, repeatable UI contract (inputs, navigation landmarks, submit buttons, persistent modals).
  Currently, `screen-learn.ts` consumes the raw DOM snapshot with almost no abstraction, treating ephemeral viewport items as permanent architectural features of the screen.

---

## 4. Summary Matrix of Findings & Causes

| Problem Area | Observed Defect | Primary Architectural Root Cause |
|---|---|---|
| **Agent Adoption** | Agent writes custom Python scripts instead of calling `pwa_*` tools. | Intimidating negative instructions in `pwa_open` ("Do NOT browse") + "PWA" naming bias + LLM default training weight towards Playwright/Python. |
| **Persistence** | Screens appear not to save or cannot be resolved across runs. | Path divergence (`.agent/screens/` vs. `.agent/apps/<slug>/`) + slug discrepancy (`www-` vs non-`www`) + multiple map collisions + global directory fallback (`~/.pwa-nav`). |
| **Dynamic Routing** | Every message thread generates a new screen in `screens[]`. | `screen-learn.ts` uses raw `pathname` without segment parameterization (e.g. UUID, hash, or Base64 detection). |
| **Element Noise** | Screen map flooded with reactions, timestamps, usernames, and unread counters. | Overly narrow heuristics in `isProse` and `isTransientName`, lack of badge counter scrubbing, and non-detection of informal dynamic list containers. |
| **External Pollution** | Links in chat messages (Google Drive, Meet, PDFs) stored as app links. | Collector treats any `<a>` element in user-generated message bodies as structural application links. |

---

## 5. Next Steps

Before drafting implementation specifications or altering code:
1. Validate these hypotheses against additional application profiles (e.g., Google NotebookLM, Mercadona, GitHub).
2. Establish formal boundary definitions for what constitutes a "Structural Control" vs. "Ephemeral User Content" in the screen map domain model.
3. Align on the single source of truth for screen persistence across the CLI, MCP server, and runtime provisioner.
