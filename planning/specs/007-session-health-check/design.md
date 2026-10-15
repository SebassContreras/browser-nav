# 007 - session-health-check - Design

## Approach

- D1@1 (implements R1): Shared profile-database adapter `src/browser/profile-db.ts`: `withProfileDb(dbPath, fn)` copies `<db>` plus `<db>-wal` (when present) into a fresh temp dir, opens the copy with Node's built-in `node:sqlite` (`DatabaseSync`), passes a tiny `ProfileDb { all(sql, ...params) }` handle to `fn`, then closes and removes the temp dir in `finally`. The original files are never opened by SQLite, so Firefox's exclusive lock is never contended and nothing in the profile can be mutated. `node:sqlite` is the only vendor touched and only in this file; spec 011 is the second consumer. _(standard: hot-copy-then-read is what cookie/history readers such as yt-dlp do - https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/cookies.py; SQLite WAL semantics - https://www.sqlite.org/wal.html; `node:sqlite` - https://nodejs.org/api/sqlite.html)_
- D2@2 (implements R2, R4): Pure domain function `evaluateSessionHealth(cookies, { host, nowMs, authCookieNames?, signInHint? })` in `src/browser/session-health.ts`. Keeps cookies whose site (registrable domain, eTLD+1 per the Public Suffix List) equals the app host's site - the browser notion of "same site", so a session cookie on `.www.linkedin.com` counts for `linkedin.com` and `a.github.io` never matches `b.github.io`. The site is computed by `siteOf(host)` in `src/browser/site.ts`, the only file that imports `tldts`. Auth-like cookies are the explicit names when given, else the heuristic `/sess|sid|auth|token|login|jwt|_at$|^SAPISID$|^__(Secure|Host)-/i`. Returns `{ verdict: "authenticated" | "expired" | "unauthenticated" | "no_profile", source: "disk", ttlSeconds?, cookies: [{ name, host, expiresAt }], hint? }`. Expiry is normalised (values above 1e11 are milliseconds, else seconds) because Firefox changed the `moz_cookies.expiry` unit across versions. Cookie values are never read or returned. _(standard: Public Suffix List site grouping - https://publicsuffix.org/learn/; Firefox `publicSuffix` API - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/publicSuffix; `tldts` - https://github.com/remusao/tldts)_
- D3@1 (implements R1, R2): `readProfileCookies(profileDir)` in `src/browser/session-reader.ts` - the only place that knows the `moz_cookies` schema (`SELECT name, host, path, expiry FROM moz_cookies`), built on D1. Returns `null` when the profile or `cookies.sqlite` does not exist.
- D4@1 (implements R3, R4): `statusTool({ app, cookie? })` in `src/tools/status.ts` (resolves the slug with `appSlugFromUrl`, composes D3 + D2) exposed as `pwa_auth({ action: "status", app, cookies? })` and `pwa-nav status <app> [--cookie <name>]...`. Exit code stays `0`; the verdict is data. `expired`/`unauthenticated` carry the hint `pwa-nav auth <app>` (MCP: `pwa_auth({ action: "clean" })`). No browser, no BiDi port.

## Pros / cons and mitigations

| Pro | |
|---|---|
| Zero-launch answer in milliseconds | Agents skip doomed launches and blind timeouts |
| No new dependency | `node:sqlite` ships with Node >= 22.13 |
| Read-only by construction | SQLite only ever opens a temp copy |

| Con | Mitigation |
|---|---|
| `node:sqlite` is still experimental on Node 22 (prints an `ExperimentalWarning`) | Isolated behind `profile-db.ts` (swappable for `better-sqlite3`); loaded lazily with `await import` so other commands never warn; warning goes to stderr, never stdout/JSON. `engines` raised to `>=22.13` |
| Hot copy while Firefox writes can be momentarily inconsistent | Copy `-wal` together with the db (SQLite replays it on open); a failed copy or open is retried once on a fresh copy, then reported as a structured `session_busy` error with a retry hint instead of a raw SQLite error |
| Session-only cookies live in memory, not on disk | Verdict states `source: "disk"`; `unauthenticated` hint says the running window may still be signed in and suggests `pwa-nav snapshot` to confirm |
| Bundled PSL in `tldts` can lag behind new suffixes | Kept current through normal dependency updates; a stale suffix only degrades to `unauthenticated`, and `--cookie` still works |
| New runtime dependency (`tldts` + `tldts-core`, MIT) | Imported only in `site.ts` behind `siteOf()`; a hand-rolled "last two labels" rule was rejected because it merges unrelated sites under `co.uk` / `github.io` |
| Name heuristic can miss or over-match auth cookies | `--cookie <name>` / `cookies: []` override; the result lists matched cookie names (never values) so the agent can judge |
| Cookies are credentials | Values are never selected by the SQL query, never logged, never returned |

## Deliverables

- `src/browser/profile-db.ts` (D1), `src/browser/session-reader.ts` (D3), `src/browser/session-health.ts`, `src/browser/site.ts` (D2).
- `src/tools/status.ts`, `src/tools/auth.ts`, `src/mcp/mcp-tools.ts`, `src/cli.ts` (D4).
- Tests: profile-db never touches the original files and cleans its temp dir; health verdicts (domain match, ms/s expiry, override, missing profile); status tool output.
- Docs: `README.md`, `SKILL.md`, `docs/mcp.md`.

## Sequencing

D1 → D3 → D2 → D4.

## Decisions

- localStorage (`webappsstore.sqlite`) is dropped from R1: modern Firefox keeps localStorage per origin in `storage/default/<origin>/ls/data.sqlite`, with values that may be compressed, and auth state is cookie-based on the target apps. Revisit only with a concrete app that needs it.
