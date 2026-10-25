# 034 — Lean Screen View & Semantic Journey Templates — Design

## Approach

Applying the 10 Core Engineering Principles:

1. **KISS / YAGNI (Principle 1)**:
   - Avoid creating an intermediary presentation DSL.
   - Format plain text compact views directly in `src/screens/screen-view.ts` using clean markdown-like section headers (`Inputs:`, `Filters:`, `Modals/Opens:`, `Journeys:`, `Patterns:`).
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/screens/screen-view.ts`: Pure presentation and text compaction of a `Screen` object.
   - `src/screens/screen-prune.ts`: Service dedicated to cleaning existing screen map files on disk and recomputing valid SHA-256 fingerprints.
   - `src/ops/journey.ts`: High-level operational orchestrator executing journeys across route transitions.
3. **DRY via Composition (Principle 3)**:
   - Reuse the existing `fingerprintOf` utility in `src/screens/screen-map.ts` during pruning rather than reimplementing hash calculation.
4. **Service Layer + Anti-Corruption (Principle 4)**:
   - `screensPrune` is exposed through the standard `ToolContext` and tool layer (`src/tools/`), remaining decoupled from whether it was invoked via CLI (`browser-nav screens prune`) or MCP (`browser_screens_prune`).
5. **Small Interface & Pure Functions (Principle 5)**:
   - `renderCompactView(screen: Screen, options?: RenderOptions): string` is a pure, idempotent function.
6. **Testing Behavior, not Coverage (Principle 6)**:
   - Verify that compact view output contains no zero-occurrence clutter (`occurrence: 0`), renders sections hierarchically, and is at least 60% smaller in token length than raw dumps.
   - Verify that `screensPrune` on a fixture file removes zombie actions and produces a map that passes `crossCheck` validation with 100% integrity.
7. **Testing Hygiene (Principle 7)**:
   - Unit tests follow Arrange-Act-Assert in `src/screens/test/screen-view.test.ts` and `src/screens/test/screen-prune.test.ts` without test logic branching.
8. **Follow the Stack's Standards (Principle 8)**:
   - TypeScript ESM standard compliance, standard async file operations via `node:fs/promises`.
9. **Validate with Research (Principle 9)**:
   - Token density optimization patterns aligned with modern LLM context compaction research (markdown list format with semantic markers minimizes BPE tokenizer fragmentation).
10. **Document Trade-offs (Principle 10)**:
    - Detailed below in Decisions with mitigations.

---

## Decisions

- D1@1 (implements R1): **Hierarchical Compact View Formatting**.
  - Group screen elements into structural sections: `Inputs`, `Filters`, `Actions`, `Modals/Opens`, and `Journeys`. Omit internal JSON Schema properties and omit `[occ: 0]` when occurrence is 0.
  - *Trade-off*: Compact view format differs slightly from legacy unsectioned view.
  - *Mitigation*: Legacy parser regexes in tests are updated, and the new structure is strictly easier for LLMs to consume.

- D2@1 (implements R4): **Screen Prune Command with Cryptographic Fingerprint Integrity**.
  - `browser-nav screens prune <app>` cleans dynamic list noise from an existing map on disk and recomputes the SHA-256 fingerprint of each pruned screen.
  - *Trade-off*: Mutates existing `.agent/apps/<appSlug>/screens.json`.
  - *Mitigation*: Creates a `.screens.json.bak` backup file before writing and runs full `crossCheck` before committing changes to disk.

- D3@1 (implements R2, R3): **Journey Parameter Templating & Agent Guidance Alignment**.
  - Support standard template substitution `${inputs.varName}` in `src/ops/journey.ts` and document the workflow distinction in `AGENTS.md`: fixed controls use `@id`/`journey`, dynamic search results use `browser_find`.
  - *Trade-off*: Journeys require pre-definition.
  - *Mitigation*: Agents can execute direct `@id` actions if no pre-defined journey fits their specific goal.
