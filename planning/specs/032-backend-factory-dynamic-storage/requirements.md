# Requirements: Backend Factory Honors Dynamic Storage

## Context

Spec 020 introduced dynamic workspace storage: `browser_config set` (and per-call `cacheDir` / `workspaceDir`) update the session's active `.agent` directory, and `getBackend(ctx, req)` (`src/tools/common.ts`) resolves the effective directory and passes it to `ctx.backendFactory({ ..., cacheDir })`.

The production factories drop that value:

- `src/mcp.ts` builds the backend with `cacheDir: opts.cacheDir` (the directory fixed at process start), ignoring `request.cacheDir`.
- `src/cli.ts` (`makeBackend`, used by the bridge/REPL factories) ignores `req.cacheDir` too.
- `src/mcp/mcp-flows.ts` (flow and journey tools) and the `snapshot` resource in `src/mcp/mcp-server.ts` call `backendFactory({ armed })` directly, bypassing `getBackend`, so they never receive the active directory.

Observed failure: the MCP server runs with `cwd` = the browser-nav repo. After `browser_config({ action: "set", workspaceDir: ".../job" })`, `browser_config get` reports `.../job/.agent`, but `open`, `snapshot`, `learn` and session/cookie files are still written to `browser-nav/.agent`.

Tests did not catch it because `src/mcp/test/mcp-workspace.test.ts` injects a hand-written factory that already honors `cacheDir`. No test exercises the factory that production actually uses.

## Requirements

- R1@1: Every backend created through `ToolContext.backendFactory` in production entry points (`browser-nav-mcp`, `browser-nav` bridge/REPL) MUST use `request.cacheDir` when it is provided, and fall back to the startup cache dir only when it is absent.
- R2@1: After `browser_config set` with `workspaceDir` or `cacheDir`, every MCP tool that touches storage (core tools, `flow_*` tools, journey tools) and the snapshot resource MUST read and write under the new active `.agent` directory, without a restart.
- R3@1: Per-call `cacheDir` / `workspaceDir` overrides MUST keep their spec 020 semantics: they win for that call only and do not change the session default.
- R4@1: Precedence MUST stay as spec 020 defines it: per-call `cacheDir` > per-call `workspaceDir` > session (`browser_config` / initialize handshake) > startup `--cache-dir` / env / cwd project root.
- R5@1: Regression tests MUST use the production factory (not a test double that already honors `cacheDir`). They MUST fail on the current code and pass after the fix.
- R6@1: Existing tests (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`) MUST keep passing with no test weakened or skipped.
