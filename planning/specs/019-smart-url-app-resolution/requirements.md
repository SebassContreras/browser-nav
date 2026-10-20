# 019 - smart-url-app-resolution - Requirements

## What's being built

A robust URL and application target resolution system for `pwa_open` and CLI `open`, featuring pre-navigation validation (fail-fast), automatic resolution of registered application slugs and canonical domain aliases, and explicit schema definitions and agent prompts to eliminate broken tabs caused by typos or incomplete domain inputs (such as `"linkedin"` or `"linkeding"`).

## Who it serves

AI coding agents and operators interacting with `pwa-nav` via MCP or CLI, ensuring that navigation commands resolve reliably or fail immediately with clear diagnostic feedback before any browser tab or process is spawned.

## Requirements

- R1@1: Pre-navigation validation and fail-fast rejection: When an input passed to `open` or `pwa_open` is neither a valid HTTP(S) URL, nor an existing registered app slug, nor a recognizable domain format or known canonical alias, reject immediately with error code `invalid_args` and explanatory guidance without spawning any browser process or opening a dead tab in Firefox.
- R2@1: Registered app slug and canonical alias resolution: When an unadorned slug or known service name is provided (e.g. `notebook` registered in `.agent/allow.json`, or canonical web aliases like `linkedin`, `google`, `mercadona`, `github`, `twitter`, `x`), automatically resolve it to its canonical HTTPS starting URL before navigation.
- R3@1: Domain name auto-completion: When a domain without protocol is provided (e.g. `linkedin.com` or `www.mercadona.es`), safely normalize it by prepending `https://` only after validating domain syntax (valid hostname and TLD), preventing bare strings without TLD from becoming pseudo-URLs like `https://linkeding`.
- R4@1: MCP tool schema, descriptions, and agent instruction alignment: Update `pwa_open` input schema, tool descriptions, `BASE_INSTRUCTIONS`, `AGENTS.md`, and `SKILL.md` to explicitly specify valid navigation target formats (full URL or registered slug), provide concrete examples (`https://www.linkedin.com`), and explicitly forbid passing arbitrary bare words or typos.

## Out of scope

- Performing arbitrary web search queries or search engine scraping via `open` (in-app search uses `pwa_fill` and `pwa_click`).
- Dynamic DNS pre-flight network pings before navigation.

## Dependencies

- 005 (automatic-pwa-provisioning: PwaProvisioner and slug resolution).
- 018 (canonical-app-origin-mapping: FileAppRegistry and canonical slug resolution).

## Owner split

Agent: resolution logic, validation rules, MCP schemas, instructions, tests. Human: verify agent tool invocation behavior.
