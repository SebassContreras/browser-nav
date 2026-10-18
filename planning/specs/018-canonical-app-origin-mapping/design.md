# 018 - canonical-app-origin-mapping - Design

## Context

When interacting with web apps that redirect or span multiple domains/subdomains (such as `notebook.google.com` redirecting to `notebooklm.google.com`), `pwa-nav` derives the application slug strictly from the literal URL hostname (`appSlugFromUrl`). Consequently, separate directory trees (`.agent/apps/<slug>/`) are created for the same application, causing profiles, cookies, and screen maps to diverge. Spec 018 establishes canonical application and multi-origin mapping centered around `.agent/allow.json`.

## Approach

- D1@1 (implements R1): Enriched and backward-compatible `AllowConfig` schema in `src/core/app-registry.ts`.
  - Supports legacy format `{ "origins": ["https://..."] }` and enriched format with `apps: Record<string, { name?: string; origins: string[] }>`.
  - Pure function `normalizeOrigin(url: string): string | null` normalizes paths, trailing slashes, and protocols.
  - Pure helper `resolveCanonicalSlug(url: string, config: AllowConfig): string` checks if the origin belongs to any declared app before falling back to `appSlugFromUrl`.
- D2@1 (implements R1, R2): `AppRegistry` service interface and `FileAppRegistry` implementation in `src/core/app-registry.ts`.
  - Defines small, testable service interface:
    - `resolveSlug(urlOrOrigin: string): Promise<string>`
    - `registerAppOrigin(origin: string, appSlug: string, appName?: string): Promise<void>`
    - `getAllowedOrigins(): Promise<string[]>`
  - `FileAppRegistry` handles atomic persistence to `.agent/allow.json` using temp file write and rename.
  - `MemoryAppRegistry` provides zero-I/O boundary mocking for unit and integration testing.
- D3@1 (implements R1, R4): Integration into `src/core/gate.ts`.
  - `loadAllowList` and `decideAction` recognize origins from both the flat `origins` list and all declared `apps.*.origins` entries.
- D4@1 (implements R2, R4): Injection of `AppRegistry` into `DefaultPwaProvisioner` (`src/browser/provisioner.ts`).
  - `DefaultPwaProvisioner` accepts optional `AppRegistry` in constructor (defaults to `FileAppRegistry`).
  - Directs profile creation, desktop shortcut generation, and screen map resolution to the canonical app slug.
- D5@1 (implements R3): Auto-aliasing on redirection and explicit `--app` flag in `openTool` (`src/tools/open.ts`).
  - When navigation results in a destination origin different from the initial requested origin (and not blocked by `isLoginBarrier`), automatically associates the initial origin with the destination app slug in `.agent/allow.json`.
  - Honors explicit `--app <slug>` passed via CLI or MCP.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Zero-friction unification | Redirection-heavy apps converge to one profile automatically |
| Full backward compatibility | Legacy `allow.json` files continue to function without migration |
| Clean architecture adherence | Pure functions for domain resolution, small injectable service interface |

| Con | Mitigation |
|---|---|
| Unintended aliasing on third-party auth redirects | Login barriers (such as `accounts.google.com`) are explicitly filtered via `isLoginBarrier()` |
| Concurrent file writes to `allow.json` | `FileAppRegistry` uses atomic temp-file write-and-rename pattern |

## Deliverables

- `src/core/app-registry.ts` (D1, D2) + tests in `src/core/test/app-registry.test.ts`.
- Updates to `src/core/gate.ts` (D3) + tests in `src/core/test/gate.test.ts`.
- Updates to `src/browser/provisioner.ts` (D4) + tests in `src/browser/test/provisioner.test.ts`.
- Updates to `src/tools/open.ts` (D5) + tests in `src/tools/test/open.test.ts`.

## Sequencing

D1 and D2 establish the registry domain service. D3 wires it into gate authorization. D4 connects provisioner resolution. D5 binds redirection and CLI/MCP auto-aliasing.
