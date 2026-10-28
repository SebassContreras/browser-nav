# 037 — screen-map-normalization

## Goal
Ensure backwards compatibility and resilience when reading screen maps by automatically normalizing object-structured `screens` maps into standard array schemas, and ensuring discovery seamlessly detects maps in canonical `.agent/apps/<appSlug>/screens.json` as well as legacy paths.

## Requirements
- R1: `validateScreenMap` and `loadScreenMap` accept screen map data where `screens` is an object dictionary (`Record<string, Screen>`), normalizing it into an array of screens (`Screen[]`) with `id` keys preserved.
- R2: Screen map loader `loadScreenMapsFromDir` discovers and loads screen maps located at `.agent/apps/<appSlug>/screens.json`, `.agent/apps/<appSlug>.screens.json`, and `.agent/screens/<appSlug>.screens.json` without failing schema validation.

## Design
- D1 (R1): In `src/screens/screen-map.ts`, implement a pure function `normalizeScreenMapRaw(raw: unknown): unknown`. If `raw.screens` is a non-null, non-array object, convert its entries `[key, val]` into objects with `{ id: key, ...val }` before passing `raw` to the Ajv validator.
- D2 (R2): Add unit tests in `src/screens/test/screen-map.test.ts` and `src/screens/test/screen-match.test.ts` verifying that object-style maps and varied directory layouts load into valid `ScreenMap` models.

## Tasks
- [ ] 037/T001 [agent] Regression tests in `src/screens/test/screen-map.test.ts` for object-structured screens normalization — covers R1
- [ ] 037/T002 [agent] Implement `normalizeScreenMapRaw` in `src/screens/screen-map.ts` called before Ajv schema validation — covers D1
- [ ] 037/T003 [agent] Integration tests in `src/screens/test/screen-match.test.ts` verifying discovery across legacy and canonical paths — covers R2, D2
