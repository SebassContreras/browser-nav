# 032 — backend-factory-dynamic-storage — Design

## Approach

Applying the 10 Core Engineering Principles:

1. **KISS / YAGNI (Principle 1)**: The resolution logic already exists (`getBackend` in `src/tools/common.ts`, `resolveAgentDir` in `src/core/storage.ts`). This fix only wires it through. No new config layer, no new storage abstraction. The workspace-auto-detect hook and `browser_config` stay as they are.
2. **SRP (Principle 2)**:
   - `getBackend` (tools layer) decides *which* directory is active.
   - The backend factory (backend layer) builds a backend for *the directory it is given*. It does not consult session state.
   - Entry points (`mcp.ts`, `cli.ts`) supply only startup defaults.
3. **DRY via Composition (Principle 3)**: `mcp.ts` and `cli.ts` each hand-write a factory that maps a request onto `createBackend`. That is two real uses of the same mapping, so it moves to one helper, `createBackendFactory(defaults)`, in `src/backend/backend-factory.ts`. Both entry points compose it. Flow tools and the snapshot resource reuse `getBackend` rather than calling `backendFactory` directly.
4. **Dependency Inversion (Principles 4 & 5)**: Tools keep depending on the injected `BackendFactory` type, not on `createBackend`. The new helper takes a small structural request type (`{ armed?, launch?, port?, app?, cacheDir? }`), so `src/backend/` does not import from `src/tools/`. The direction stays backend ← tools.
5. **Testing (Principles 6 & 7)**: Regression tests go through `createBackendFactory` (the production code path) with the offline backend, which is the boundary double the repo already uses. Each test names one behavior, uses Arrange-Act-Assert, and has no conditionals or loops.
6. **Stack standards (Principle 8)**: Same TypeScript strict style, `exactOptionalPropertyTypes` spread idiom (`...(x === undefined ? {} : { x })`), `node:test` + `assert/strict`, and test files under `src/**/test/`.
7. **Research (Principle 9)**: This follows the factory-with-defaults pattern (a closure over startup config, with per-request overrides). The MCP spec gives servers one long-lived process per client, and `cwd` is client-controlled (Antigravity, Claude Desktop and Cursor set it from config, not from the open project). So startup `cwd` cannot be the source of truth for the workspace. Runtime overrides must reach the backend, which confirms R1/R2.
8. **Trade-offs (Principle 10)**: See Decisions.

---

### Decisions

- D1@1 (implements R1, R4): **`createBackendFactory(defaults)` in `src/backend/backend-factory.ts`.**
  ```ts
  export interface BackendDefaults extends Omit<CreateBackendOptions, "armed" | "launch"> {}
  export interface BackendFactoryRequest { armed?: boolean; launch?: boolean; port?: number; app?: string; cacheDir?: string }
  export function createBackendFactory(defaults: BackendDefaults): (req: BackendFactoryRequest) => Backend
  ```
  Each per-request field wins over its default (`req.cacheDir ?? defaults.cacheDir`, and the same for `port` and `app`). `armed` and `launch` come only from the request.
  - *Pros*: One mapping instead of two hand-written ones, so the bug cannot reappear in one entry point and not the other. Pure and testable without MCP.
  - *Cons*: One more exported symbol, and `cli.ts`'s `makeBackend(live, extra)` changes shape.
  - *Mitigation*: `makeBackend` becomes a thin call to the same helper, built from the live config. In the CLI, `live` can change at runtime (`config set` in the REPL), so the CLI builds the factory per call from current `live`. No caching is added (YAGNI).

- D2@1 (implements R1): **`src/mcp.ts` uses `createBackendFactory({ mode, port, app, cacheDir })`.** This removes the inline lambda that ignored `cacheDir`.

- D3@1 (implements R1): **`src/cli.ts` bridge/REPL factories forward `req.cacheDir` (and `port`/`app`) through the same helper**, defaulting to `live.agentDir`.

- D4@1 (implements R2, R3): **Flow and journey tools call `getBackend(ctx)`** (`src/mcp/mcp-flows.ts`) instead of `ctx.backendFactory({ armed: ctx.armed })`.
  - *Pros*: The same precedence as the core tools, from a single function.
  - *Cons*: `mcp-flows.ts` gains an import from `src/tools/common.ts`.
  - *Mitigation*: The tools layer is already an allowed dependency of `src/mcp/` (it imports `actTool`), so no new layer edge is added.

- D5@1 (implements R2): **The snapshot resource reads from the active directory.** In `src/mcp/mcp-server.ts`, `agentPath(screens.cacheDir ?? baseCtx.agentDir, "snapshot.json")` replaces building a throwaway backend only to read `agentDir`.
  - *Pros*: The read no longer has the side effect of constructing a backend.
  - *Cons*: It duplicates the session part of `getBackend`'s precedence (no per-call override applies to a resource read anyway).
  - *Mitigation*: Read the exact same fields `getBackend` falls back to (`ctx.screens.cacheDir ?? ctx.agentDir`). This is covered by a regression test (T006).

- D6@1 (implements R5): **Regression tests use the production factory.**
  - Unit test: `src/backend/test/backend-factory.test.ts` checks that `createBackendFactory({ mode: "offline", cacheDir: A })({ armed: false, cacheDir: B }).agentDir === resolve(B)`, and that the default is used when the request has none.
  - E2E: `src/mcp/test/mcp-workspace.test.ts` replaces its hand-written factory with `createBackendFactory({ mode: "offline", cacheDir: startDir })`, so the existing workspace-switch scenario actually guards production wiring. It adds E2E cases where `open` and the snapshot resource follow `browser_config set`. The flow case is a handler-level test that records the `cacheDir` the flow asks the factory for. The offline backend cannot run flows, and an E2E flow assertion passed even before the fix, so it could not fail (Principle 6).
  - *Pros*: These tests fail on the current code (the factory ignores `cacheDir`).
  - *Cons*: The E2E change touches an existing test.
  - *Mitigation*: Its assertions stay unchanged; only the injected factory is swapped from a test double to the real one. That makes the test stricter, not weaker.

## Deliverables

- `src/backend/backend-factory.ts`: `createBackendFactory`, `BackendDefaults`, `BackendFactoryRequest`.
- `src/backend/test/backend-factory.test.ts`: unit regression tests.
- `src/mcp.ts`: uses `createBackendFactory`.
- `src/cli.ts`: `makeBackend` / bridge and REPL factories forward `cacheDir`.
- `src/mcp/mcp-flows.ts`: flow and journey handlers use `getBackend(ctx)`.
- `src/mcp/mcp-server.ts`: the snapshot resource reads the active directory.
- `src/mcp/test/mcp-workspace.test.ts`: uses the production factory, plus a flow/resource case.
- `docs/mcp.md`: one note saying `browser_config set` applies to all tools without a restart, and that a pinned `cwd` / `--cache-dir` is only the startup default.

## Sequencing

1. Write the failing tests first (T001, T005, T006) and confirm they fail on `main`.
2. Add `createBackendFactory` (T002) and wire `mcp.ts` (T003) and `cli.ts` (T004).
3. Route flows/journeys and the snapshot resource through the active directory (T007, T008).
4. Update the docs (T009) and run full validation (T010).
