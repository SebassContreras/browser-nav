# 033 — Dynamic List & Feed Noise Pruning — Design

## Approach

Applying the 10 Core Engineering Principles:

1. **KISS / YAGNI (Principle 1)**:
   - We do not create an elaborate AST evaluator or ML-based classifier.
   - We implement direct, proportional filtering predicates `isDynamicListItemAction`, `isDynamicResultsContainer`, `isStructuralControl` directly in `src/screens/screen-learn.ts` (alongside existing predicates like `isAnonymousListCheckbox` and `isConversationItemControl`), matching against observable container roles (`feed`, `list` of search results) and button role patterns.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/screens/screen-learn.ts`: Contains pure decision predicates for what elements constitute noise (`isDynamicListItemAction`, `isDynamicContentLink`), orchestrates ingestion of elements, applies filtering predicates, builds structural `fields` and `actions`, and instantiates `patterns` for collections with `dynamicChildren: true`.
3. **DRY via Composition (Principle 3)**:
   - Reuse existing text folding (`foldText`) and container inspection utilities.
   - Compose container-level check functions rather than duplicating regular expressions across handlers.
4. **Service Layer + Anti-Corruption (Principle 4)**:
   - Operates entirely on domain types (`RawElement`, `Screen`, `ScreenAction`, `EntityPattern`). No browser-vendor specifics (BiDi or Playwright) leak into this filtering layer.
5. **Small Interface & Pure Functions (Principle 5)**:
   - Every filtering rule is a pure function: `(raw: RawElement, context?: FilterContext) => boolean`, fully deterministic and stateless.
6. **Testing Behavior, not Coverage (Principle 6)**:
   - Test that observable noise is eliminated: when given raw elements containing 10 job search cards and 3 filter buttons, only the 3 filter buttons and the search box are persisted in the screen map, while the cards are excluded and a single `pattern` descriptor is created.
   - Regression test using real-world fixtures to verify >80% line reduction on catalog/search pages.
7. **Testing Hygiene (Principle 7)**:
   - Strict Arrange-Act-Assert structure in `src/screens/test/screen-filtering.test.ts`. Clear test names declaring expected behavioral invariants. No conditionals or loops in test assertions.
8. **Follow the Stack's Standards (Principle 8)**:
   - Strict TypeScript ESM, explicit return types, immutable data transformations, adhering to standard Node 22 test runner idioms.
9. **Validate with Research (Principle 9)**:
   - Grounded in W3C WAI-ARIA 1.2 specifications for `feed`, `list`, `listitem`, and `article` landmarks to ensure standard accessibility trees are parsed identically across LinkedIn, Mercadona, Amazon, and GitHub.
10. **Document Trade-offs (Principle 10)**:
    - Detailed below in Decisions with mitigations.

---

## Decisions

- D1@1 (implements R1, R4): **Dynamic item and card action filtering**.
  - Identify interactive items nested within dynamic result lists (`role: "feed"`, `role: "list"` inside search results or main query panels) and discard item-specific buttons (e.g. dismiss buttons, specific job card headings, inline item reaction toggles).
  - *Trade-off*: An agent cannot click a specific result card directly via `@id`.
  - *Mitigation*: The agent uses `browser_find({ query })` to locate and click the specific card in live sessions without cluttering `screens.json`.

- D2@1 (implements R2): **Dynamic Collection Pattern Descriptor**.
  - When a container has multiple repeating child items, `screen-learn.ts` generates a concise entry in `patterns[]` with `{ id: "<container-slug>", containerRole: "list", itemRole: "listitem", dynamicChildren: true }`.
  - *Trade-off*: Screen map schema now includes `patterns[]` entries that the agent must interpret.
  - *Mitigation*: The compact view renderer formats this as a single concise line (e.g. `pattern: job-cards (list of dynamic items)`), informing the agent to use `browser_find`.

- D3@1 (implements R3, R5): **Exemption of Structural Controls**.
  - All controls modifying the query or view (search inputs, filter toggle buttons matching `/filtrar|filter|sort|ordenar/i`, comboboxes, and pagination buttons) are explicitly protected and retained in `fields[]` or `actions[]`.
  - *Trade-off*: Some filter bars have numerous options.
  - *Mitigation*: These are valid structural controls that agents genuinely need to operate; keeping them is essential for deterministic automation.
