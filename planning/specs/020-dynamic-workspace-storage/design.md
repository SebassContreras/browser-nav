# 020 — dynamic-workspace-storage — Design

## Approach

- D1@1 (implements R1): Dynamic configuration service & MCP tool (`pwa_config`). Expose a dedicated MCP tool `pwa_config` in `src/mcp/mcp-tools.ts` backed by `src/tools/config.ts` (and operational action `performConfig` in `src/ops/config.ts`). It supports read mode (inspecting active `cacheDir`, `screensDir`, project root, and fallback mode) and mutate mode (updating active `cacheDir` or `workspaceDir` on the fly for subsequent requests in the running session).
- D2@1 (implements R2): Contextual storage resolution with per-call workspace overrides. Update `src/tools/types.ts` and core tools (`open`, `snapshot`, `click`, `fill`, `act`, `find`, `extract`, `wait`, `screenshot`, `auth`, `status`, `discover`) to accept optional `workspaceDir` and `cacheDir` parameters. Storage paths (`apps/<slug>/profile`, `screens.json`, `allow.json`, `session.json`) are resolved dynamically through an injectable pure helper `resolveEffectiveStorage(opts, defaultContext)` without mutating persistent session context unless explicitly updated via `pwa_config`.
- D3@1 (implements R3): MCP `initialize` workspace auto-detection. In `src/mcp/mcp-server.ts`, hook the MCP JSON-RPC protocol initialization handshake to extract `workspaceFolders` or `rootUri` parameters if provided by the client (e.g. IDE or agent environment). When present and not overridden by explicit CLI `--cache-dir`, automatically resolve and bind the active workspace root to `<projectRoot>/.agent`.
- D4@1 (implements R4): Pure storage resolver and clean isolation boundary. Refactor storage directory resolution in `src/core/storage.ts` into pure, composable helper functions (`resolveWorkspaceAgentDir`, `resolveEffectiveStorage`) ensuring all app profiles (`.agent/apps/<slug>/profile`), screen maps, allow-lists, and lock files converge strictly inside the designated workspace when set, cleanly falling back to `~/.pwa-nav` when outside any project context. Eliminate all obsolete and hardcoded directory resolution paths across the repository.

## Trade-offs & Mitigations

- **Decision 1: Dynamic session context vs. immutable server configuration.**
  - *Pros*: Agents and IDEs can switch workspaces without restarting the Node process or losing connection to Firefox WebDriver BiDi.
  - *Cons*: Concurrent tool calls could theoretically experience race conditions if a tool mutates global session state mid-flight.
  - *Mitigation*: Per-call overrides (`workspaceDir` / `cacheDir`) take precedence on a per-invocation basis without mutating the session default. Mutation via `pwa_config` is deterministic and synchronizes active screen sources and directory contexts atomically.
- **Decision 2: Pure storage resolution utility vs. monolithic configuration class.**
  - *Pros*: Follows KISS, SRP, and pure function principles (Principle 1, 2, 5). Easily testable in isolation with in-memory paths without mock environments or global variable patching.
  - *Cons*: Requires threading optional `workspaceDir` / `cacheDir` through tool options.
  - *Mitigation*: Unified `ToolContext` and `CommonToolOptions` in `src/tools/types.ts` provide clean composition without duplicating argument declarations.
- **Decision 3: Zero stale code and legacy fallback pruning.**
  - *Pros*: Keeps codebase clean, eliminates dead code paths, enforces strict separation of concerns.
  - *Cons*: Refactoring existing `resolveAgentDir` calls requires updating references across `src/browser/`, `src/tools/`, and `src/mcp/`.
  - *Mitigation*: Centralize pure helpers in `src/core/storage.ts` and export backwards-compatible wrappers where appropriate while deprecating direct calls.

## Deliverables

- `src/core/storage.ts`: Pure workspace and cache directory resolution logic (`resolveWorkspaceAgentDir`, `resolveEffectiveStorage`).
- `src/core/test/storage.test.ts`: Isolated unit tests for storage resolution, workspace folder mapping, and fallback logic.
- `src/tools/config.ts`: Core `configTool` implementing inspect and update semantics.
- `src/ops/config.ts`: Operation layer logic for inspecting and mutating active runtime storage.
- `src/tools/types.ts`: Common options and context types updated with `workspaceDir`.
- `src/mcp/mcp-server.ts`: MCP `initialize` handshake listener for `workspaceFolders` / `rootUri`.
- `src/mcp/mcp-tools.ts`: Register `pwa_config` tool and expose optional `workspaceDir` parameter in tool schemas.
- `src/tools/test/config.test.ts`: Unit and integration tests for `pwa_config` and per-call overrides.
- Documentation: Update `AGENTS.md`, `SKILL.md`, and MCP docs.

## Sequencing

1. Implement core pure storage resolver and unit tests (`src/core/storage.ts`, `src/core/test/storage.test.ts`).
2. Update tool context and types (`src/tools/types.ts`) and create config tool (`src/tools/config.ts`, `src/ops/config.ts`).
3. Wire `pwa_config` and per-call overrides into `src/mcp/mcp-tools.ts`.
4. Implement `initialize` handshake auto-detection in `src/mcp/mcp-server.ts`.
5. Remove obsolete hardcoded storage resolution paths and ensure clean isolation.
6. Integration and behavior tests for dynamic workspace switching.
