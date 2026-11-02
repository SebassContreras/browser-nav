# 037 — screen-map-normalization

## Goal
Ensure backwards compatibility and resilience when reading screen maps by automatically normalizing object-structured `screens` maps into standard array schemas, and ensuring discovery seamlessly detects maps in canonical `.agent/apps/<appSlug>/screens.json` as well as legacy paths.

## Requirements
- R1: `validateScreenMap` and `loadScreenMap` accept screen map data across partitions: canonical arrays (`Screen[]`, passed through unchanged), object dictionaries (`Record<string, Screen>`, converted to `Screen[]` with `id` populated from entry keys when omitted or matching), empty objects (`{}` normalized to `[]`), and invalid non-object types (rejected by schema validation). All other top-level properties (`$schema`, `schemaVersion`, `app`, `journeys`, `unmapped`) are preserved.
- R2: Screen map loader `loadScreenMapsFromDir` discovers and loads screen maps across directory layouts (`.agent/apps/<appSlug>/screens.json`, `.agent/apps/<appSlug>.screens.json`, and `.agent/screens/<appSlug>.screens.json`), deduplicating identical resolved paths and sorting entries alphabetically without failing schema validation on object-structured maps.

## Design
- D1 (R1): In `src/screens/screen-map.ts`, implement and export a pure function `normalizeScreenMapRaw(raw: unknown): unknown`. If `raw` is a non-null object whose `screens` property is a non-null, non-array object, return a shallow clone with `screens` mapped from entries `[key, val]` into objects with `{ id: key, ...val }` (or preserving existing `val.id`). If `raw` is not an object or `raw.screens` is an array or invalid, return `raw` unmodified for Ajv schema validation. Call `normalizeScreenMapRaw` inside `validateScreenMap` before Ajv schema validation.
- D2 (R2): In `src/screens/screen-match.ts`, `loadScreenMapsFromDir` resolves paths across canonical apps directories (`.agent/apps/<appSlug>/screens.json`), flat app files (`.agent/apps/<appSlug>.screens.json`), and legacy screens directories (`.agent/screens/<appSlug>.screens.json`), loading each candidate via `loadExplicitMap` -> `loadScreenMap` -> `validateScreenMap`, deduplicating paths with `seenPaths`, and returning sorted `LoadedMap[]`.

### Trade-offs & Mitigations
- In-memory runtime normalization vs permanent schema migration: Normalizing `screens` objects at parse time in `validateScreenMap` provides transparent backward compatibility for legacy and hand-authored maps without rewriting on-disk files during read operations. *Mitigation:* Normalization is non-destructive and in-memory only; write operations continue to enforce and emit the canonical schema array format.
- Dictionary key vs inner `id` collision: When normalizing `Record<string, Screen>`, an inner `val.id` might conflict with the entry dictionary key. *Mitigation:* The dictionary key takes precedence as the authoritative screen ID (`{ ...val, id: key }`), maintaining route/target lookup consistency while preserving all inner screen attributes.

## Tasks
- [x] 037/T001 [agent] Table-driven regression tests in `src/screens/test/screen-map.test.ts` for `normalizeScreenMapRaw` and `validateScreenMap` across input partitions (canonical array pass-through, dictionary object to array conversion, empty object `{}` to `[]`, dictionary entry missing id fallback to key, preservation of other top-level fields, rejection of non-object screens by Ajv) — covers R1, D1
      verified: `npx tsx --test src/screens/test/screen-map.test.ts` passed 23/23 tests covering all table-driven normalization partitions
- [x] 037/T002 [agent] Implement `normalizeScreenMapRaw` in `src/screens/screen-map.ts` called before Ajv schema validation in `validateScreenMap` — covers R1, D1
      verified: `validateScreenMap` in `src/screens/screen-map.ts` runs normalization before schema validation, passing tests and linter
- [x] 037/T003 [agent] Table-driven integration tests in `src/screens/test/screen-match.test.ts` verifying `loadScreenMapsFromDir` discovery across path partitions (canonical directory `.agent/apps/<appSlug>/screens.json`, flat app `.agent/apps/<appSlug>.screens.json`, legacy screens `.agent/screens/<appSlug>.screens.json`, mixed with object-structured maps), deduplication invariants, and alphabetical sorting — covers R2, D2
      verified: `npx tsx --test src/screens/test/screen-match.test.ts` passed 22/22 tests verifying canonical, flat, and legacy discovery
- [x] 037/T004 [agent] Verify: run CI gate (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`) across touched modules (`src/screens/`) — covers R1, R2
      verified: `pnpm lint`, `pnpm build`, `npx tsx --test src/screens/**/*.test.ts`, and `pnpm smoke` passed with 0 errors across 132 tests

## Changes
- 2026-11-02: Text audit:
  - F1: Added ### Trade-offs & Mitigations under ## Design documenting in-memory normalization vs permanent disk migration and dictionary key vs inner id precedence (ENG-6).
  - F2: Rewrote D2 from a testing instruction into an architectural design describing path resolution and loader integration in `src/screens/screen-match.ts` (ENG-2, SRP).
  - F3: Refined R1 and R2 with concrete input partitions, boundaries, top-level field preservation, path discovery layouts, and deduplication/sorting invariants (TEST-I1, TEST-I2, ENG-1).
  - F4: Rewrote T001 and T003 as table-driven test tasks specifying partitions, boundary conditions, and contract assertions (TEST-I1, TEST-I2, TEST-H2).
  - F5: Aligned task coverage tags on T001 and T002 to cover both requirement R1 and design D1 (TRACE, ENG-2).
  - F6: Added T004 CI gate verification task covering `pnpm lint`, `pnpm build`, `pnpm test`, and `pnpm smoke` across touched modules (TRACE).
