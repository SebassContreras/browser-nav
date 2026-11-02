# 040 — test-suite-rename-alignment

## Goal
`pnpm lint && pnpm build && pnpm test && pnpm smoke` passes. Six MCP tests in `src/mcp/test/` still assert the legacy `pwa-nav` names after the rename to `browser-nav`. We know the spec is done when `pnpm test` reports 0 failures and no test asserts a legacy-only name for output the product no longer emits.

## Requirements
- R1: In `src/mcp/test/mcp-runtime.test.ts`, runtime install hint assertions verify the canonical MCP install tool `browser_install_runtime` across missing-runtime and elicitation partitions:
  - Decline partition (`action: "decline"`): prompt shown, user declines -> returns `isError: true`, install hint matches `/browser_install_runtime/`, installs = 0.
  - Cancel partition (`action: "cancel"`): prompt shown, user cancels -> returns `isError: true`, install hint matches `/browser_install_runtime/`, installs = 0.
  - Fails partition (`elicitation: "fails"`): elicitation request throws/fails -> returns `isError: true`, install hint matches `/browser_install_runtime/`, installs = 0.
  - Unsupported partition (`capabilities: {}` / no elicitation): returns `isError: true`, install hint matches `/browser_install_runtime/`, installs = 0.
  - Invariant: When the managed runtime is missing without active user consent, `browser_open` fails with `no_browser` code and diagnostic hint citing canonical MCP tool `browser_install_runtime` (CLI: `browser-nav runtime install`).
- R2: In `src/mcp/test/mcp.stdio.test.ts:96` and `src/mcp/test/mcp.bidi.stdio.test.ts:311`, stdio startup ready banner assertions verify the canonical server banner across transport and backend partitions:
  - Offline stdio transport partition (`--backend offline`): stderr ready banner matches `/browser-nav-mcp ready/`.
  - BiDi stdio transport partition (`--backend bidi --armed`): stderr ready banner matches `/browser-nav-mcp ready \(backend bidi, ARMED\)/`.
  - Invariant: Ready banner emitted to stderr on stdio server startup begins with `browser-nav-mcp ready` and indicates backend mode and safety state (ARMED | dry-run) per `src/mcp.ts:116`.
- R3: Product code remains unchanged, and legacy backward compatibility is preserved. Invocations using legacy tool aliases (e.g. `pwa_open`, `pwa_install_runtime`) and legacy CLI aliases continue to function and remain covered by compatibility tests.

## Design
- D1 (R1): In `src/mcp/test/mcp-runtime.test.ts`, update install-hint regular expression assertions from `/pwa_install_runtime/` to `/browser_install_runtime/` across all unconsented and missing-runtime partitions (`decline`, `cancel`, `fails`, `unsupported`). Product emission in `src/browser/pwa-runtime.ts` and `src/tools/runtime.ts` remains untouched ([PRODUCT.md](../../PRODUCT.md)).
- D2 (R2): In `src/mcp/test/mcp.stdio.test.ts` and `src/mcp/test/mcp.bidi.stdio.test.ts`, update ready banner stderr assertions to expect canonical branding `/browser-nav-mcp ready/` and `/browser-nav-mcp ready \(backend bidi, ARMED\)/`, matching the output format emitted by `src/mcp.ts:116`.
- D3 (R3): Scope test alignment strictly to emitted output assertions. Test calls dispatching to legacy alias names (such as `h.call("pwa_install_runtime", {})` or `h.call("pwa_open", ...)`) remain unchanged to verify continued support for deprecated aliases.

### Trade-offs & Mitigations
- Aligning test assertions to canonical product names vs keeping tests backward-compatible with legacy emitted names: The product intentionally migrated to `browser-nav` / `browser-nav-mcp` / `browser_install_runtime`. Asserting obsolete `pwa_*` output in tests causes false test failures on the canonical product, but changing test inputs could accidentally remove coverage for backward-compatibility aliases. *Mitigation:* Update only output/emitted string assertions to canonical naming, while preserving legacy tool input calls (e.g. `h.call("pwa_open")`, `h.call("pwa_install_runtime")`) to guarantee that legacy alias dispatch remains verified.
- Strict regex matching vs loose prefix matching for stderr banners: Matching exact banners (`/browser-nav-mcp ready \(backend bidi, ARMED\)/`) ensures strict contract verification, but can be brittle if startup options or formatting change. *Mitigation:* Assert the canonical prefix `browser-nav-mcp ready` and relevant backend/armed state flags in stdio integration tests, matching the exact format string emitted in `src/mcp.ts`.

## Tasks
- [x] 040/T001 [agent] Update install-hint assertions in `src/mcp/test/mcp-runtime.test.ts` to `/browser_install_runtime/` across elicitation and missing-runtime partitions (`decline`, `cancel`, `fails`, `unsupported`) — covers R1, D1
      verified: `npx tsx --test src/mcp/test/mcp-runtime.test.ts` passed 6/6 tests with canonical `browser_install_runtime` hint assertions
- [x] 040/T002 [agent] Update ready-banner assertions in `src/mcp/test/mcp.stdio.test.ts` and `src/mcp/test/mcp.bidi.stdio.test.ts` to expect `/browser-nav-mcp ready/` across offline and BiDi partitions — covers R2, D2
      verified: `npx tsx --test src/mcp/test/mcp.stdio.test.ts src/mcp/test/mcp.bidi.stdio.test.ts` passed 6/6 tests confirming canonical ready banner matching
- [x] 040/T003 [agent] Audit remaining test suites in `src/**/*.test.ts` for other stale legacy output assertions, updating only emitted string checks while preserving alias input invocations — covers R3, D3
      verified: audited all `src/**/*.test.ts` assertions via `git grep`; zero remaining stale `pwa_`/`pwa-nav` output assertions found and all 37 MCP tests in `src/mcp/test/*.test.ts` pass with legacy alias calls preserved
- [ ] 040/T004 [agent] Verify: run CI gate (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`) across all suites, confirming 0 test failures and zero broken legacy output assertions — covers R1, R2, R3, D1, D2, D3

## Changes
- 2026-11-02: Text audit:
  - F1: Added `### Trade-offs & Mitigations` under `## Design` documenting canonical test output alignment versus legacy alias input retention and stderr banner matching (ENG-6).
  - F2: Refined R1, R2, and R3 with concrete input partitions (`decline`, `cancel`, `fails`, `unsupported`), stderr transport modes, contract invariants, and backward compatibility bounds (TEST-I1, TEST-I2, TEST-I3, ENG-1).
  - F3: Split D1 into separate single-responsibility design items D1 (R1) and D2 (R2), and formulated D3 (R3) for alias preservation (ENG-2).
  - F4: Separated test suite output auditing from CI gate verification in tasks T003 and T004, resolving SRP violation and establishing isolated CI gate check (ENG-2, TRACE).
  - F5: Rewrote T001 and T002 to specify full file paths, partitions, and explicit regex expectations, and aligned all task coverage tags (`— covers R#, D#`) (TEST-I1, TEST-I2, TEST-H2, TRACE).
  - F6: Added `## Changes` section recording audit findings F1–F6 (TRACE).
