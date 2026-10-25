# Requirements: Lean Screen View & Semantic Journey Templates

## Context

Agents consuming `browser_snapshot({ screen: true })` or CLI `browser-nav snapshot --screen` currently receive an unpruned list of elements if the screen has not been normalized, consuming valuable context window tokens. Furthermore, agents executing complex multi-step workflows across applications lack structured journey templates and execution guidance in the MCP layer, leading agents to fallback to slow, error-prone token-heavy raw DOM loops.

Additionally, existing screen maps learned before Spec 033 (such as `linkedin-com/screens.json`) remain bloated with thousands of obsolete lines, requiring an automated offline prune tool to normalize existing files without losing custom metadata.

## Requirements

- R1@1: `screen-view.ts` MUST format the compact view of screens with hierarchical grouping: structural inputs and filters first, modal triggers second, followed by available patterns and user journeys, omitting verbose occurrence counters when `occurrence == 0`.
- R2@1: `browser-nav journey` and MCP tools MUST allow authoring and running named journeys directly from templates with variable substitution (e.g. `${inputs.query}`) without prompting for intermediate step approvals unless human intervention (`humanOnly: true`) is required.
- R3@1: Screen map documentation and agent prompt guidance MUST explicitly define the workflow distinction:
  - Fixed application structure $\rightarrow$ Operate via `@id` targets or `journey`.
  - Dynamic content/hits $\rightarrow$ Search via `browser_find` or scrape via `browser_extract`.
- R4@1: An offline migration/cleanup command (`browser-nav screens prune <app>`) MUST allow pruning existing bloated screen maps into lean schemas conforming to the noise-pruned standard, recalculating fingerprints to maintain cross-check sha256 validity.
