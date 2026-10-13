# 007 - session-health-check - Design

## Approach

- D1@1 (implements R1): Shared profile-database adapter `src/browser/profile-db.ts`: `withProfileDb(dbPath, fn)` copies `<db>` plus `<db>-wal` (when present) into a fresh temp dir, opens the copy with Node's built-in `node:sqlite` (`DatabaseSync`), passes a tiny `ProfileDb { all(sql, ...params) }` handle to `fn`, then closes and removes the temp dir in `finally`. The original files are never opened by SQLite, so Firefox's exclusive lock is never contended and nothing in the profile can be mutated. `node:sqlite` is the only vendor touched and only in this file; spec 011 is the second consumer. _(standard: hot-copy-then-read is what cookie/history readers such as yt-dlp do - https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/cookies.py; SQLite WAL semantics - https://www.sqlite.org/wal.html; `node:sqlite` - https://nodejs.org/api/sqlite.html)_
- D2@1 (implements R2, R4): Pure domain function `evaluateSessionHealth(cookies, { host, now, authCookieNames? })` in `src/browser/session-health.ts`. Filters cookies by RFC 6265 domain-match against the app host, selects auth-like cookies (explicit names, else the heuristic `/sess|sid|auth|token|login|jwt|^SAPISID$|^__(Secure|Host)-/i`), and returns `{ verdict: "authenticated" | "expired" | "unauthenticated" | "no_profile", ttlSeconds?, cookies: [{ name, host, expiresAt }], hint? }`. Expiry is normalised (values above 1e11 are milliseconds, else seconds) because Firefox changed the `moz_cookies.expiry` unit across versions. Cookie values are never read or returned. _(standard: RFC 6265 §5.1.3 domain matching - https://www.rfc-editor.org/rfc/rfc6265#section-5.1.3)_
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
| Hot copy while Firefox writes can be momentarily inconsistent | Copy `-wal` together with the db (SQLite replays it on open); a failed open is retried once, then reported as `unknown` in the hint instead of crashing |
| Session-only cookies live in memory, not on disk | Verdict states `source: "disk"`; `unauthenticated` hint says the running window may still be signed in and suggests `pwa-nav snapshot` to confirm |
| Name heuristic can miss or over-match auth cookies | `--cookie <name>` / `cookies: []` override; the result lists matched cookie names (never values) so the agent can judge |
| Cookies are credentials | Values are never selected by the SQL query, never logged, never returned |

## Deliverables

- `src/browser/profile-db.ts` (D1), `src/browser/session-reader.ts` (D3), `src/browser/session-health.ts` (D2).
- `src/tools/status.ts`, `src/tools/auth.ts`, `src/mcp/mcp-tools.ts`, `src/cli.ts` (D4).
- Tests: profile-db never touches the original files and cleans its temp dir; health verdicts (domain match, ms/s expiry, override, missing profile); status tool output.
- Docs: `README.md`, `SKILL.md`, `docs/mcp.md`.

## Sequencing

D1 → D3 → D2 → D4.

## Decisions

- localStorage (`webappsstore.sqlite`) is dropped from R1: modern Firefox keeps localStorage per origin in `storage/default/<origin>/ls/data.sqlite`, with values that may be compressed, and auth state is cookie-based on the target apps. Revisit only with a concrete app that needs it.
