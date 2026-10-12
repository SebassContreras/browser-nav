# 011 - screen-map-history-discovery - Design

## Approach

- D1@1 (implements R1): Introduce `HistoryReader` service adapter (`src/browser/history-reader.ts`) implementing `HistoryStoreReader` to query visited URLs, titles, and visit timestamps from `.agent/apps/<appSlug>/profile/places.sqlite` in read-only immutable mode, filtered strictly by target origin/domain. _(standard: Mozilla Places SQLite schema - https://developer.mozilla.org/en-US/docs/Mozilla/Tech/Places/Database)_
- D2@1 (implements R2, R3): Implement route candidate discovery engine `discoverCandidateRoutes(historyEntries, existingScreenMap)` (`src/screens/screen-discover.ts`) that matches extracted paths against existing route patterns in `.agent/apps/<appSlug>/screens.json`, clusters unmapped paths, and scaffolds candidate skeletal screen structures with suggested `@id` targets. _(judgement, no standard)_
- D3@1 (implements R3): Integrate candidate merging into `mergeScreen` / `screen-store.ts` with `--dry-run` and interactive/auto confirmation flags to prevent unintentional pollution of existing screen maps. _(judgement, no standard)_
- D4@1 (implements R4): Expose discovery via CLI `pwa-nav screens discover <app>` and MCP tool operation, returning structured candidate screens without requiring a live browser launch. _(judgement, no standard)_

## Deliverables

- `src/browser/history-reader.ts`: `HistoryStoreReader` interface and SQLite history query adapter (D1).
- `src/screens/screen-discover.ts`: Route path matcher and candidate generation engine (D2, D3).
- `src/tools/discover.ts`: Tool operation for route discovery (D4).
- `src/cli/cli-screens.ts`: Add `discover` subcommand to `pwa-nav screens` (D4).
- Unit and integration tests in `src/browser/test/history-reader.test.ts` and `src/screens/test/screen-discover.test.ts`.

## Sequencing

1. D1: HistoryReader adapter and SQLite unit tests.
2. D2, D3: Route discovery engine and screen map candidate clustering.
3. D4: Tool and CLI wiring.

## Open questions

None.
