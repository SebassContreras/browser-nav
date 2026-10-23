# 024 — screen-map-storage-unification — Design

## Approach

- D1@1 (implements R1, R2): Unify canonical app slug derivation and screen map path resolution into `src/core/storage.ts` via pure functions `resolveAppScreenMapPath(agentDir, appSlug)` (`<agentDir>/apps/<appSlug>/screens.json`) and enforce standard slugification in `appSlugFromUrl` (`src/backend/backend.ts`) such that leading `www.` is always stripped, hostnames are lowercased and sanitized, and ports are stripped or mapped consistently across CLI and MCP tools.
- D2@1 (implements R1, R3): In `loadScreenMapsFromDir` (`src/screens/screen-match.ts`), when scanning for maps, automatically prefer `<agentDir>/apps/<appSlug>/screens.json`. If a legacy `<agentDir>/screens/<appId>.screens.json` exists without a corresponding app-scoped map, transparently load or copy/migrate it without failing with multi-map collision errors when both locations point to the same origin.
- D3@1 (implements R1): In `executeLearn` (`src/tools/learn.ts`) and auto-collaborate in `src/ops/ops.ts`, write newly learned screen maps strictly to `<agentDir>/apps/<appSlug>/screens.json` by default (unless an explicit `--screen-map` is given), completely deprecating writing new maps directly into `<screens-dir>/<appId>.screens.json`.
- D4@1 (implements R4): Ensure explicit `--screen-map <file>` or `--screens-dir <dir>` parameters take absolute precedence across `loadMap`, `executeLearn`, and snapshot tools without mutating or polluting default application directories.
- D5@1 (implements R5): In `resolveAgentDir` (`src/core/storage.ts`), strictly verify that when running inside any workspace or git repository root, resolution always yields `<workspaceRoot>/.agent`, falling back to global `~/.pwa-nav` only when no workspace root can be identified.

## Trade-offs and Mitigations

- **Decision 1 (Canonical location per app slug)**:
  - *Pros*: Eliminates loose screen map proliferation; standardizes all app artifacts (profile, sessions, screens.json) under `.agent/apps/<appSlug>/`.
  - *Cons*: Older projects may have maps placed in `.agent/screens/<app>.screens.json`.
  - *Mitigation*: Transparent migration/fallback loader in `loadScreenMapsFromDir` (D2@1) ensures backwards compatibility without collisions.

- **Decision 2 (Strict www-stripping & idempotent slug)**:
  - *Pros*: Guarantees `https://www.linkedin.com` and `https://linkedin.com` share the exact same profile and `screens.json`, preventing route cache misses and `unmapped_screen` (13) errors.
  - *Cons*: Potential edge case if a domain intentionally serves completely different apps on `www.` vs apex.
  - *Mitigation*: Canonical aliases and `allow.json` app definitions can explicitly map custom slugs or origins if distinct apps are ever required.

- **Decision 3 (Workspace root precedence)**:
  - *Pros*: Guarantees multi-agent teams and tests running in project repositories never pollute `~/.pwa-nav`.
  - *Cons*: Extra directory traversal on path resolution.
  - *Mitigation*: Cached/memoized or fast upward traversal with root markers (`.git`, `package.json`, `.agent`) already implemented and tested in `findProjectRoot`.

## Deliverables

- `src/core/storage.ts`: add `resolveAppScreenMapPath` and enforce consistent workspace directory resolution.
- `src/backend/backend.ts`: ensure `appSlugFromUrl` strips `www.` uniformly and normalizes domains identically.
- `src/screens/screen-match.ts`: update `loadScreenMapsFromDir` and `selectMap` to handle legacy migration / deduplication between legacy `screens/<app>.screens.json` and `apps/<slug>/screens.json`.
- `src/tools/learn.ts`: target `<agentDir>/apps/<appSlug>/screens.json` as default output path for new screen maps.
- `src/ops/ops.ts`: align screen map auto-collaborate write and load paths with the unified storage structure.
- Unit and integration tests covering slug idempotence, storage resolution, legacy fallback/migration, and CLI/MCP learn/snapshot flows.

## Sequencing

1. Core storage and slug utilities (`src/core/storage.ts`, `src/backend/backend.ts`).
2. Screen map loader deduplication and legacy migration (`src/screens/screen-match.ts`).
3. Tool integration for learn and snapshot (`src/tools/learn.ts`, `src/ops/ops.ts`).
4. End-to-end and regression tests.
