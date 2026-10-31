# 040 — test-suite-rename-alignment

## Goal
`pnpm lint && pnpm build && pnpm test && pnpm smoke` passes. Six MCP tests in `src/mcp/test/` still assert the legacy `pwa-nav` names after the rename to `browser-nav`. We know the spec is done when `pnpm test` reports 0 failures and no test asserts a legacy-only name for output the product no longer emits.

## Requirements
- R1: `src/mcp/test/mcp-runtime.test.ts` asserts the current install hint. The product emits `browser_install_runtime` (CLI: `browser-nav runtime install`), but the tests expect `/pwa_install_runtime/`. Affected tests: the `decline`, `cancel`, `fails` cases of `pwa_open --launch without Firefox` and `client without elicitation`.
- R2: `src/mcp/test/mcp.stdio.test.ts:96` and `src/mcp/test/mcp.bidi.stdio.test.ts:311` assert the current ready banner. `src/mcp.ts:116` prints `browser-nav-mcp ready (backend …, ARMED|dry-run)`, but the tests expect `/pwa-nav-mcp ready/`.
- R3: The product code stays unchanged. The tests follow the current product names, and the legacy aliases (`pwa-nav`, `pwa-nav-mcp`, `PWA_NAV_*`) keep working.

## Design
- D1 (R1, R2): Update the assertions in the tests to the current names (`/browser_install_runtime/`, `/browser-nav-mcp ready/`). Do not change `src/mcp.ts` or the hint text, because the rename to `browser-nav` is the intended state ([PRODUCT.md](../../PRODUCT.md)).
- D2 (R3): Before editing, search the remaining tests for other legacy-only assertions (`pwa_`, `pwa-nav`) that check emitted output, so that only the strings the product no longer emits are changed. Legacy tool names that are still registered as aliases, such as `pwa_open` if `h.call("pwa_open")` still succeeds, stay covered.

## Tasks
- [ ] 040/T001 [agent] Update the install-hint assertions in `src/mcp/test/mcp-runtime.test.ts` to `browser_install_runtime` — covers R1, D1
- [ ] 040/T002 [agent] Update the ready-banner assertions in `mcp.stdio.test.ts` and `mcp.bidi.stdio.test.ts` to `browser-nav-mcp ready` — covers R2, D1
- [ ] 040/T003 [agent] Search the tests for other stale `pwa_`/`pwa-nav` output assertions, fix them, and run the full CI gate until it is green — covers R3, D2
