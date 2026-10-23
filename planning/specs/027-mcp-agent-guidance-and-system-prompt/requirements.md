# Requirements: MCP Agent Guidance and System Prompt

## Context

Autonomous AI agents often avoid calling `pwa_*` tools and instead fall back to generating synthetic Python scripts (Playwright/Selenium). Root causes include intimidating negative tool descriptions (e.g. `"CRITICAL: Do NOT call pwa_open to perform searches or browse"`) and the absence of clear system instructions explaining that synthetic bot scripts will be blocked by Cloudflare and bot-wall defenses.

## Requirements

- R1@1: The description of `pwa_open` (and its alias) MUST be neutral and welcoming for general navigation, removing prohibitive language like `"Do NOT call ... to perform searches or browse"`.
- R2@1: The MCP server initialization handshake MUST provide clear `instructions` stating that `pwa-nav` connects to an authentic browser with active user session/authentication, serving as the agent's primary web automation capability.
- R3@1: The MCP server `instructions` MUST explicitly warn agents that synthetic Python/Playwright/Selenium scripts will trigger anti-bot defenses (Cloudflare, CAPTCHAs, bot-walls) and that native tools must be prioritized for web tasks.
- R4@1: Each tool's description and parameter docs MUST clearly explain its role in direct browser automation, eliminating ambiguities regarding installed PWAs versus live web surfing.
