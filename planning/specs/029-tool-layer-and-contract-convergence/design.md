# 029 — tool-layer-and-contract-convergence — Design

## Approach

Applying the Core Engineering Principles:
1. **Single Source of Truth / Service Layer (Principles 3 & 9)**: Unify CLI and MCP command handling by having both thin adapters delegate to `src/tools/`. The CLI parses arguments and calls the corresponding `*Tool` function, formatting the returned `ToolOutcome` for terminal display.
2. **Deterministic Element Grounding (Principles 1 & 8)**: Fix the `FIXME` in `src/screens/screen-resolve.ts` for single-depth scoped targets (`@pattern(query)>@action`). Resolving `@contact(Fede)>@delete-btn` finds the pattern `@contact`, matches child action `@delete-btn` (from pattern actions or its `opens` branch), and sets the locator with `containerQuery` or contextual role/name so BiDi locate targets the correct card element. Update `TARGET_PATTERN` in `src/mcp/mcp-tools.ts` to allow `@id`, `@id(query)`, and `@id(query)>@action`.
3. **Safety Gate & Protocol Fidelity (Principles 4 & 5)**: Update `downloadTool` to check `assertArmedAllowed`, pass `port` in MCP `baseCtx`, and remove the unused `snapshot` flag from `cmdDownload`.
4. **App Instance Port Resolution (Principle 2)**: In `src/backend/backend-factory.ts`, when `options.app` is provided and `options.port` is default/unspecified, check `FileInstanceRegistry.findByApp(app)` to find the running instance port.
5. **Strict Typing Safety Net**: Fix the 28 type errors across test files and add `"typecheck": "tsc --noEmit -p tsconfig.json"` to `package.json`.
6. **Documentation Parity (Principle 9)**: Update `SKILL.md`, `README.md`, `AGENTS.md`, and CLI `--help` to document CLI dry-run default, canonical `browser_*` tool names, and valid parameters.

### Decisions

- D1@1 (implements R1): **Typecheck Script and Test Suite Type Safety**. Add `"typecheck": "tsc --noEmit -p tsconfig.json"` to `package.json` `scripts`. Fix all 28 `TS2532`, `TS2345`, `TS18048`, and `TS18046` type errors across `src/browser/test/cookie-extractor.test.ts`, `cookie-sync.test.ts`, `firefox-profile-discovery.test.ts`, `src/core/test/gate.test.ts`, `storage.test.ts`, `src/tools/test/auth-sync.test.ts`, and `tools.test.ts` without weakening tests.
- D2@1 (implements R2): **App Slug to Port Resolution in `createBackend`**. In `src/backend/backend-factory.ts`, if `options.app` is supplied and `options.port === undefined`, resolve the active port from `new FileInstanceRegistry({ cacheDir: options.agentDir }).findByApp(options.app)`. If found, use that port; otherwise fallback to default port.
- D3@1 (implements R3): **`downloadTool` Safety Enforcement, Port Wiring & Cleaned CLI Options**. In `src/tools/download.ts`, invoke `assertArmedAllowed` before executing downloads or BiDi extraction. In `src/mcp/mcp-server.ts`, pass `port: this.port` in `baseCtx`. In `src/cli.ts`, remove the unused `--snapshot` option from `cmdDownload`.
- D4@1 (implements R4): **Scoped Pattern Target Resolution & Schema Pattern Expansion**. In `src/screens/screen-resolve.ts`, implement single-depth scoped pattern target resolution: when `targetObj.scopedId` is present, find the pattern, look up `scopedId` in `pattern.actions`, `pattern.fields`, or `pattern.actions[].opens`, and produce a `ResolvedTarget` carrying `containerName` or `containerQuery: targetObj.query`. In `src/browser/locate.ts` and `src/screens/screen-resolve.ts:refFor`, match elements whose container context matches `targetObj.query`. In `src/mcp/mcp-tools.ts`, expand `TARGET_PATTERN` to accept `^@[a-z0-9]+(?:-[a-z0-9]+)*(?:\([^)]+\))?(?:>@[a-z0-9]+(?:-[a-z0-9]+)*)?(?:\[\d+\])?$`.
- D5@1 (implements R5): **CLI Delegation to `src/tools/` Service Layer**. Refactor `cmdSnapshot`, `cmdClick`, `cmdFill`, `cmdUpload`, `cmdAct`, `cmdScreenshot`, `cmdExtract`, `cmdFind`, `cmdWait`, `cmdJourney`, and `cmdQa` in `src/cli.ts` to call `snapshotTool`, `clickTool`, `fillTool`, `uploadTool`, `actTool`, `screenshotTool`, `extractTool`, `findTool`, `waitTool`, `journeyTool`, and `qaTool`.
- D6@1 (implements R6): **Documentation and CLI Help Parity**. Update `SKILL.md` to state that CLI is dry-run by default requiring `--armed`, remove `interactiveOnly` from `snapshot` documentation, update tool references to canonical `browser_*` and `BROWSER_NAV_*`, update `README.md` and CLI `usage()` to document `--armed` requirement and canonical commands.

## Deliverables

- `package.json`: `"typecheck"` script.
- `src/browser/test/*.test.ts`, `src/core/test/*.test.ts`, `src/tools/test/*.test.ts`: Type error fixes.
- `src/backend/backend-factory.ts`: `options.app` port resolution.
- `src/tools/download.ts`: Gate and kill-switch checks.
- `src/mcp/mcp-server.ts`: `baseCtx.port` propagation.
- `src/mcp/mcp-tools.ts`: `TARGET_PATTERN` expanded.
- `src/screens/screen-resolve.ts`: Scoped target resolution with container matching.
- `src/browser/locate.ts`: Container scoping support for locator matching.
- `src/cli.ts`: Delegation to `src/tools/`, remove unused download `--snapshot`, align usage text.
- `SKILL.md`, `README.md`, `AGENTS.md`, `docs/mcp.md`: Documentation parity.
