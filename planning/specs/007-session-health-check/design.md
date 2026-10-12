# 007 - session-health-check - Design

## Approach

- D1@1 (implements R1, R2): Introduce an anti-corruption adapter `SessionStorageReader` (`src/browser/session-reader.ts`) with interface `SessionStoreReader` to safely query SQLite databases (`cookies.sqlite`, `webappsstore.sqlite`) in read-only mode using Node 22 native `node:sqlite` (or pure buffer fallback if locked), enforcing zero process locks (`file:...??mode=ro` with `immutable=1` URI pragma or temporary read snapshot). _(standard: SQLite URI filenames and read-only immutable pragma - https://www.sqlite.org/uri.html)_
- D2@1 (implements R2, R4): Implement a domain evaluation service `evaluateSessionHealth(appSlug, domain, options)` in `src/browser/session-health.ts` that calculates session cookie TTLs, detects expired or missing auth cookies, and outputs a structured health verdict (`authenticated`, `expired`, `unauthenticated`, `no_profile`) with remaining TTL in seconds and actionable next steps. _(standard: RFC 6265 HTTP State Management Mechanism - https://www.rfc-editor.org/rfc/rfc6265)_
- D3@1 (implements R3): Expose session health inspection through CLI (`pwa-nav status <app>`) and MCP tool (`pwa_auth({ action: "status", app: "<app>" })`), delegating to `src/tools/auth.ts` and `src/ops/ops.ts` without spinning up the browser runtime or opening WebDriver BiDi ports. _(judgement, no standard)_
- D4@1 (implements R4): In `bidi-backend.ts` and `src/tools/`, add optional proactive pre-flight check when opening an app; if health status is `expired` or `unauthenticated`, return immediate actionable diagnostic message pointing to `pwa_auth clean` rather than encountering element timeouts. _(judgement, no standard)_

## Deliverables

- `src/browser/session-reader.ts`: `SessionStoreReader` interface and `SqliteSessionReader` read-only SQLite reader (D1).
- `src/browser/session-health.ts`: `evaluateSessionHealth` domain function and health verdict types (D2).
- `src/tools/auth.ts` & `src/tools/status.ts`: Integration with `pwa_auth({ action: "status" })` and `statusTool` (D3, D4).
- `src/cli.ts` & `src/cli/cli-status.ts`: CLI command `pwa-nav status <app>` (D3).
- `src/mcp/mcp-server.ts` & schemas: Expose `"status"` in `pwa_auth` action enum (D3).
- Unit and integration tests in `src/browser/test/session-reader.test.ts` and `src/browser/test/session-health.test.ts`.

## Sequencing

1. D1: SQLite read-only reader adapter with unit tests.
2. D2: Session health evaluation logic and TTL calculations.
3. D3: Expose via `authTool` and CLI `status`.
4. D4: Integration into pre-flight diagnostics.

## Open questions

None.
