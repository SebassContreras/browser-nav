# 025 — dynamic-route-parameterization — Design

## Approach

Applying the 10 Core Engineering Principles:
1. **KISS / YAGNI (Principle 1)**: Use direct, deterministic regular expression heuristics inside pure functions in `src/screens/screen-learn.ts` and `src/screens/screen-merge.ts`. No heavy third-party NLP libraries or over-abstracted tokenizer classes.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/screens/screen-learn.ts`: Owns dynamic segment detection (`isDynamicSegment`), semantic parameter naming (`inferParamName`), and pathname parameterization (`parameterizeRoute`).
   - `src/screens/screen-merge.ts`: Owns matching a newly learned screen against existing screens in a `ScreenMap` (`mergeIntoMap`), respecting existing parameterized routes before falling back to creating a new entry.
   - `src/screens/screen-match.ts`: Owns runtime route evaluation (`matchRoute`, `findScreen`) and route pattern validation (`assertValidRoutePattern`).
3. **DRY via Composition (Principle 3)**: Compose `learnScreen` with `parameterizeRoute` and `screenIdFromRoute`, and reuse `matchRoute` inside `mergeIntoMap` so route matching logic has a single source of truth across runtime lookup and learning.
4. **Service Layer & Pure Functions (Principles 4 & 5)**: Keep route parameterization and matching 100% pure, stateless, and free of I/O, making them trivially testable in isolation.
5. **Testing Behavior & Hygiene (Principles 6 & 7)**: Test observable behaviors and edge cases (UUIDs, LinkedIn base64-prefixed thread IDs, numeric IDs >= 4 digits, short version numbers like `v1`/`42` left literal, semantic singularization, duplicate param collision resolution, and re-learning against existing parameterized screens) using Given-When-Then structure without conditionals or loops in tests.
6. **Follow the Stack's Standards (Principle 8)**: Adhere to `schemas/screen-map.schema.json` and `assertValidRoutePattern` (`:paramName` matching `^:[A-Za-z_][A-Za-z0-9_]*$`, unique parameter names per route).
7. **Validate with Research (Principle 9)**: Validated against OpenTelemetry HTTP URL normalization heuristics and real-world SPA URL structures (LinkedIn `/messaging/thread/2-ZjhmMGE2NDUt.../`, GitHub/REST `/users/12345/orders/98765`, UUIDv4 paths, hex commit/object hashes).

### Decisions

- D1@1 (implements R1): **Dynamic Path Segment Detection (`isDynamicSegment`)**. In `src/screens/screen-learn.ts`, classify a URL path segment (after `decodeURIComponent`) as a dynamic token if and only if it matches any of the following deterministic patterns:
  1. **UUID**: Standard 8-4-4-4-12 hex format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
  2. **Numeric ID (>= 4 digits)**: Pure digits with length >= 4 (`/^\d{4,}$/`). Short numbers (`42`, `v1`, `2024` when prefixed) remain literal so existing static test routes like `/users/42/edit` do not regress unless >= 4 digits.
  3. **Hexadecimal Hash (>= 8 chars)**: Pure hex characters `[0-9a-fA-F]` of length >= 8 containing at least one digit and one hex letter (or length >= 16 pure hex) (`/^(?=.*[0-9])(?=.*[a-f])[0-9a-f]{8,}$/i`).
  4. **Base64 / High-Entropy Token**: Strings containing base64 padding (`=`), prefixed encoded tokens (such as LinkedIn's `2-ZjhmMGE2NDUt...` matching `/^\d+-[A-Za-z0-9_-]{12,}=*$/`), or mixed-case/alphanumeric tokens of length >= 16 containing both letters and digits or mixed case with hyphens/underscores (`/^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9_-]{16,}=*$/` or `/^(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9_-]{16,}=*$/`). Pure lowercase hyphenated words (e.g. `forgot-password`, `account-settings`) are preserved as literal segments.
- D2@1 (implements R1, R3): **Deterministic Semantic Parameter Naming (`parameterizeRoute`)**. Export `parameterizeRoute(pathname: string): string` in `src/screens/screen-learn.ts` and invoke it in `learnScreen` to normalize `new URL(page.url).pathname` (stripping trailing slashes except for root `/`). When segment `i` is dynamic:
  - Inspect preceding segment `i - 1`: if it is a literal word segment (not starting with `:`), derive a camelCase singular base name + `Id` (e.g. `threads` or `thread` -> `:threadId`, `users` -> `:userId`, `categories` -> `:categoryId`, `boxes` -> `:boxId`, `messages` -> `:messageId`).
  - If there is no preceding literal segment (e.g. root-level `/:id`) or the preceding segment is itself a parameter, fallback to `:id` for the first unnamed parameter, and `:param2`, `:param3`, etc. (`:paramN`) when `:id` is already taken.
  - Ensure uniqueness across the route: if a derived parameter name (e.g. `:threadId` or `:id`) is already used earlier in the same route, append an incrementing numeric suffix (`:threadId2`, `:id2` or `:param2`) so `assertValidRoutePattern` never fails on duplicate parameter names.
  - Update `screenIdFromRoute(route: string)` to strip leading `:` from parameterized segments before slugifying (or derive clean slugs like `messaging-thread-threadid`) so screen IDs remain valid schema slugs (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- D3@1 (implements R2): **Parameterized Route Matching on Screen Merge (`mergeIntoMap`)**. In `src/screens/screen-merge.ts`, update screen lookup inside `mergeIntoMap` so that when `map.screens` does not have an exact `screen.route === learned.route` match, it checks whether any existing screen's `route` matches `learned.route` (or vice versa, via `matchRoute(screen.route, rawPathname)` / `unifiable` pattern equivalence). When an existing screen in the map has a route pattern that matches the current page's pathname or parameterized route (choosing the highest `routeSpecificity` match), `mergeIntoMap` merges into that existing `Screen` (preserving the existing screen's `id` and `route`) instead of appending a duplicate screen entry.
- D4@1 (implements R4): **Runtime Route Matching & Compact View Compatibility**. Ensure `matchRoute` and `findScreen` in `src/screens/screen-match.ts` and `locateScreen` / `renderScreenView` in `src/tools/screen.ts` & `src/screens/screen-view.ts` seamlessly evaluate parameterized routes produced by `parameterizeRoute` (including URL-encoded base64/token segments in live URLs) and render the parameterized route pattern in the compact view header without requiring literal pathname equality.

## Trade-offs & Mitigations (Principle 10)

- **Decision 1: Numeric ID threshold of >= 4 digits vs all numbers.**
  - *Pros*: Prevents false positives on API version segments (`/v1/`, `/2/`) and preserves existing unit test fixtures (`/users/42/edit` -> `users-42-edit`).
  - *Cons*: A database auto-increment ID between `1` and `999` won't be auto-parameterized on first learn if the user hasn't defined a pattern route in the map.
  - *Mitigation*: By combining D1@1 with D3@1, if a screen map already defines `/users/:id` (or `/items/:id`), `mergeIntoMap` and `findScreen` match `/users/42` against `/users/:id` via `matchRoute`.
- **Decision 2: Heuristic Base64 / token detection vs dictionary lookup.**
  - *Pros*: Zero external dependencies, sub-millisecond execution, deterministic across locales (Spanish, English, etc.).
  - *Cons*: Long compound kebab-case slugs (e.g., `/how-to-reset-your-password-quickly`) could be mistaken for tokens if only length is checked.
  - *Mitigation*: Require non-dictionary signals for alphanumeric segments: either base64 `=` padding, digit+letter mixture, or camel/mixed-case characters, explicitly excluding pure lowercase alpha-hyphenated slugs (`/^[a-z]+(-[a-z]+)*$/`) unless they match UUID or hex hash rules.
- **Decision 3: Keeping existing screen `id` and `route` when merging into a pre-existing parameterized screen.**
  - *Pros*: Guarantees stability of `@id` references and `screenId` in `journeys[]` even if a user manually authored `/orders/:orderId` while auto-inference would have named it `:id`.
  - *Cons*: The learned screen's initial `learned.route` might differ in param name from `existing.route`.
  - *Mitigation*: `mergeScreen(existing, learned)` already preserves `existing.id` and `existing.route`, and `mergeIntoMap` matches by pattern equivalence (`unifiable` / `matchRoute`) when exact string equality is not met.

## Deliverables

- `src/screens/screen-learn.ts`: Add `isDynamicSegment`, `inferParamName`, `parameterizeRoute`, and integrate into `learnScreen`.
- `src/screens/screen-merge.ts`: Update `mergeIntoMap` to match existing parameterized routes against learned routes.
- `src/screens/test/screen-learn.test.ts`: Unit tests for dynamic segment parameterization, semantic parameter naming, and fallback rules (R1, R3).
- `src/screens/test/screen-merge.test.ts`: Unit tests verifying re-learning on different dynamic URL instances merges into the existing parameterized screen without duplication (R2).
- `src/screens/test/screen-match.test.ts`: Unit tests verifying `findScreen` and compact view resolution with parameterized routes for complex SPA URLs (R4).

## Sequencing

1. Implement `isDynamicSegment`, `inferParamName`, and `parameterizeRoute` in `src/screens/screen-learn.ts` and wire into `learnScreen`.
2. Add unit tests in `src/screens/test/screen-learn.test.ts` covering R1 and R3.
3. Update `mergeIntoMap` in `src/screens/screen-merge.ts` to resolve existing screens by parameterized route compatibility.
4. Add unit tests in `src/screens/test/screen-merge.test.ts` and `src/screens/test/screen-match.test.ts` covering R2 and R4.
5. Run full CI verification (`pnpm lint && pnpm build && pnpm test && pnpm smoke`) and `python .spectrace/trace.py check`.
