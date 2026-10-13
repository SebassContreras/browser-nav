# 011 - screen-map-history-discovery - Design

## Context

The screen map contract says screens are "learned from live snapshots, never invented" and already has a home for known gaps: `unmapped[]` (`{ route, reason, note }`). History tells us a route exists, not what is on it, so discovery fills `unmapped[]` instead of inventing skeletal screens; the agent then visits each candidate and runs `snapshot --learn`. This keeps R3's goal (bootstrap the map) without breaking the existing invariant.

## Approach

- D1@1 (implements R1): `readProfileHistory(profileDir, origin)` in `src/browser/history-reader.ts`, the only place that knows the Places schema. Built on spec 007's `withProfileDb` (temp copy, never the live file): `SELECT url, title, visit_count, last_visit_date FROM moz_places WHERE rev_host = ? AND hidden = 0 AND visit_count > 0`, using the indexed reversed host (`moz.www` + `.`), then an exact origin check in JS (scheme and port too). `last_visit_date` is PRTime (microseconds). _(standard: Places database schema - https://firefox-source-docs.mozilla.org/browser/places/architecture-overview.html)_
- D2@1 (implements R2): Pure `discoverRoutes(entries, map)` in `src/screens/screen-discover.ts`:
  1. Normalise each URL to a pathname (drop query and hash, trailing slash).
  2. Generalise dynamic segments into params: numeric → `:id`, UUID → `:uuid`, long hex/opaque tokens (>= 16 chars, mixed digits and letters) → `:token`; repeated param names get a suffix (`:id2`) so the route passes `assertValidRoutePattern`.
  3. Group by generalised route, summing visits and keeping the latest title and date.
  4. Drop routes already covered by a screen (`matchRoute` from `screen-match.ts`) or already in `unmapped[]`.
  5. Sort by visits desc, cap at `limit` (default 50).
- D3@1 (implements R3): `applyDiscovery(map, candidates)` appends `{ route, reason: "history", note: "<visits> visits, last <date>, title \"<title>\"" }` to `unmapped[]`. Writing is opt-in (`--write`); the default is a dry-run listing. The schema enum for `unmapped.reason` gains `"history"`.
- D4@1 (implements R4): `discoverTool({ app, write?, limit? })` in `src/tools/discover.ts`; CLI `pwa-nav screens discover <app> [--write] [--limit <n>]`; MCP `pwa_discover`. No browser launch, no BiDi.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Instant list of real, visited routes, ranked by use | |
| Zero browser round-trips; works with Firefox closed or open | |
| Keeps the "never invented" contract | |

| Con | Mitigation |
|---|---|
| Heuristic param detection can over- or under-generalise (`/settings/2fa`) | Conservative rules (pure digits, UUID, long mixed tokens only); candidates are suggestions in `unmapped[]`, confirmed by a live learn |
| History contains private data (titles, ids in paths) | Read only the app's own isolated profile and exact origin; dry-run by default; titles only go into the local map |
| Single-page apps may not record every client-side route | Places records `pushState` navigations; gaps are covered by the existing live learn flow |
| History can be empty or pruned | Empty result is a normal answer with a hint to browse or use `snapshot --learn` |

## Deliverables

- `src/browser/history-reader.ts` (D1), `src/screens/screen-discover.ts` (D2, D3), `schemas/screen-map.schema.json` + `src/screens/screen-map.ts` types (D3).
- `src/tools/discover.ts`, `src/cli.ts`, `src/mcp/mcp-tools.ts` (D4).
- Tests: history reader on a fixture `places.sqlite` (origin filter, hidden rows); discovery (generalisation, covered routes, dedupe, cap); tool dry-run vs write.
- Docs: `docs/screen-map.md`, `docs/mcp.md`, `SKILL.md`.

## Sequencing

D1 → D2 → D3 → D4. Depends on 007 (`withProfileDb`).
