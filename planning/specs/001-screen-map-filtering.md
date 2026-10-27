# 001 — screen-map-filtering

## Goal
Screen Map persistence (`pwa_learn` and the auto-learn inside `pwa_snapshot`) stops writing
user content - chat messages, reactions, quoted messages, feed items - into
`screens.json` as static `@id` targets. Live snapshots keep seeing everything.
Source: GitHub issue #3.

## Requirements
- R1: After learning a screen, `screens.json` contains no field, action or link whose element sits inside a dynamic content region (ARIA `feed`, `log` or `article`); the region appears only as a pattern entry.
- R2: Outside dynamic regions, an element named from its own text (`nameSource: "content"`) that reads as prose - at least 5 words and ending in `.`, `!`, `?` or `…` - is not persisted.
- R3: An element whose accessible name matches the transient blocklist (reactions, quoted messages, in English and Spanish) is not persisted, wherever it sits.
- R4: Live `pwa_snapshot` output is unchanged by this spec: every element excluded from persistence is still listed with a ref and can be found and clicked.
- R5: A dynamic region is persisted as one pattern per item role, marked `dynamicChildren: true`, with no per-item ids - also when the screen already exists in `screens.json`.
- R6: UI chrome outside dynamic regions (e.g. "Send", "Attach file", "Sign in", "Search") is persisted exactly as before.
- R7: Entries already in `screens.json` that the new rules exclude are removed when learning with `prune`, and kept otherwise.

### Who it serves
Agents and developers who learn screens of chat, feed or comment UIs and need a
`screens.json` that stays valid across threads and sessions.

### Out of scope
- Abstract item templates with per-item fields (`@message-bubble-template` contents) beyond the pattern entry.
- User-configurable blocklists.
- Automatic cleanup of existing `screens.json` files without `prune`.

### Dependencies
None.

### Owner split
Agent: code, tests, docs. Human: one check against a real chat PWA with a live, logged-in session.

## Design
### Approach

- D1 (R1, R5): The collector's `containerOf` first looks for the outermost `[role="feed"]` or `[role="log"]` ancestor and reports it as the container; failing that, it also recognises `article` (tag or role) next to the existing list/grid/region roles. Reporting the outer stream - not each message - gives every item the same container key. _(standard: WAI-ARIA 1.2 `feed`, `log`, `article` roles - https://www.w3.org/TR/wai-aria-1.2/#feed)_
- D2 (R1, R5): `learnScreen` treats `feed`, `log` and `article` as dynamic container roles: every element inside one goes into a pattern (even a single element), gets no field/action/link entry, and the pattern carries `dynamicChildren: true`. `EntityPattern` and `schemas/screen-map.schema.json` gain the optional boolean `dynamicChildren`. _(judgement, no standard)_
- D3 (R2): `learnScreen` drops an element when `nameSource === "content"` and its name has at least 5 words and ends in `.`, `!`, `?` or `…`. Labels, aria-labels, titles and placeholders are never judged as prose. _(judgement, no standard)_
- D4 (R3): `learnScreen` drops an element whose name matches one case-insensitive, accent-folded blocklist constant: names starting with `reaction`, `view reactions`, `quoted message`, `reaccion`, `ver reacciones` or `mensaje citado`. _(judgement, no standard)_
- D5 (R4): All filtering lives in `learnScreen` - the single persistence path used by `src/tools/learn.ts` and the auto-learn in `src/ops/ops.ts`. The collector output, snapshot file, ref store and `pwa_find` are untouched, apart from the extra container roles in D1.
- D6 (R5): `mergeScreen` merges `patterns` by id: learned patterns replace existing ones with the same id, new ones are added, and existing ones not seen again are dropped only with `prune`.
- D7 (R7): No new cleanup step; previously persisted content entries leave through `mergeScreen`'s existing `prune` path, because they're no longer learned.

### Deliverables

- `src/browser/collector.ts` - dynamic container detection (D1).
- `src/screens/screen-map.ts`, `schemas/screen-map.schema.json` - `dynamicChildren` (D2).
- `src/screens/screen-learn.ts` - dynamic patterns, prose and blocklist filters (D2-D4).
- `src/screens/screen-merge.ts` - pattern merge (D6).
- Tests beside each unit; `docs/screen-map.md` documents the persistence rules.

### Sequencing

D1 before D2 (learn relies on the container roles). The schema change ships with D2 so maps that use `dynamicChildren` still validate. D6 is independent.

## Tasks
- [x] 001/T001 [agent] Collector reports the outermost feed/log ancestor, or an article, as containerRole/containerName — covers D1
- [x] 001/T002 [agent] Add optional dynamicChildren to EntityPattern and screen-map.schema.json — covers D2
- [x] 001/T003 [agent] learnScreen folds every element inside feed/log/article into a dynamicChildren pattern — covers D2
- [x] 001/T004 [agent] learnScreen drops content-named prose elements (5+ words, sentence-final punctuation) — covers D3
- [x] 001/T005 [agent] learnScreen drops elements matching the transient-name blocklist (EN + ES, accent-folded) — covers D4
- [x] 001/T006 [agent] mergeScreen merges patterns by id, dropping unseen ones only with prune — covers D6, D7
- [x] 001/T007 [agent] Test: chat fixture with the issue #3 elements persists only patterns, no message/reaction/quote ids — covers R1, R2, R3, R5
- [x] 001/T008 [agent] Test: live snapshot of the chat fixture still lists and resolves every excluded element — covers R4, D5
- [x] 001/T009 [agent] Test: chrome controls (Send, Attach file, Sign in, Search) are still persisted unchanged — covers R6
- [x] 001/T010 [agent] Test: re-learning an existing polluted screen keeps junk without prune and removes it with prune; new patterns are added — covers R5, R7
- [x] 001/T011 [agent] Document persistence filtering rules and dynamicChildren in docs/screen-map.md — covers D2, D3, D4
- [ ] 001/T012 [human] Learn a real chat thread in a logged-in PWA and confirm screens.json holds no message content — covers R1, R3
