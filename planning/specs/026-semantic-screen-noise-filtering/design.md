# 026 — semantic-screen-noise-filtering — Design

## Approach

Applying the 10 Core Engineering Principles:
1. **KISS / YAGNI (Principle 1)**: Implement deterministic, pure heuristic functions directly inside `src/screens/screen-learn.ts` (and minimal container detection in `src/browser/collector.ts`). Do not introduce over-engineered rule engines, external NLP dependencies, or abstract filter pipelines for a single learning path.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/browser/collector.ts`: Owns DOM inspection and reporting enclosing container context (`containerRole`, `containerName`).
   - `src/screens/screen-learn.ts`: Owns deciding what qualifies as a persistent semantic screen target vs. ephemeral viewport noise, and scrubbing volatile badge counts during semantic `@id` generation.
   - `src/screens/screen-merge.ts` & `src/screens/screen-resolve.ts`: Own merging learned screens (pairing scrubbed IDs across count changes) and resolving locators.
3. **DRY via Composition (Principle 3)**: Compose `learnScreen` from small, single-purpose pure predicates (`isAnonymousListCheckbox`, `isQuickReactionControl`, `isUserContentExternalLink`, `isConversationItemControl`) and a pure normalizer (`scrubMutableBadgeCounts`) composed with `slugify` inside `deriveIds`.
4. **Service Layer & Pure Functions (Principles 4 & 5)**: Keep all noise filtering and badge scrubbing 100% pure, stateless, and free of I/O, operating on `RawElement` data structures. Live snapshots (`snapshot.json`) remain untouched so agents can still interact with any transient element via ephemeral `eN` refs.
5. **Testing Behavior & Hygiene (Principles 6 & 7)**: Write focused unit and integration tests in `src/screens/test/screen-learn.test.ts`, `src/screens/test/screen-filtering.test.ts`, and `src/browser/test/collector.test.ts` following Given-When-Then / Arrange-Act-Assert without conditionals or loops in tests.
6. **Follow the Stack's Standards (Principle 8)**: Preserve JSON Schema compliance (`schemas/screen-map.schema.json`), `crossCheck` invariants, and TypeScript strict mode (`exactOptionalPropertyTypes` / `noUncheckedIndexedAccess` conventions).
7. **Validate with Research (Principle 9)**: Validated against real-world captured LinkedIn, messaging, and feed screen maps (`planning/investigation-screen-maps-and-agent-behavior.md` and `.agent/apps/linkedin-com/screens.json`), covering WAI-ARIA container semantics, Spanish/English notification badge formats, LinkedIn quick-reaction chips, and `/safety/go/` redirector links.

### Decisions

- D1@1 (implements R1): **Anonymous List/Feed/Conversation Checkbox Filtering (`isAnonymousListCheckbox`)**. In `src/screens/screen-learn.ts`, exclude any element with `role === "checkbox"` (or `role === "switch"`) whose accessible `name` is empty (`""`) or a generic placeholder slug (`"checkbox"`, `"seleccionar"`, `"select"`, `"select-row"`, `"toggle"`) when it sits inside a list, grid, table, rowgroup, feed, log, article, or region container (`element.containerRole !== undefined`), or when its `name` is completely empty (`""`) outside a form field label. This eliminates `@checkbox-1..N` and `@switch-1` batch-selection noise in virtualized message and job lists while preserving named form checkboxes (e.g. `"Remember me"`, `"Empleos"`).
- D2@1 (implements R2): **Quick-Reaction & Emoji Affirmation Filtering (`isQuickReactionControl`)**. In `src/screens/screen-learn.ts`, extend transient control filtering to exclude `button`, `checkbox`, and `option` elements that represent quick reactions or emoji affirmations:
  1. Pure emoji or emoji + count labels (e.g. `"👍"`, `"❤️ 2"`, `"🎉"`).
  2. Known quick-reply / affirmation phrases in Spanish and English (accent-folded, case-insensitive) or short phrases starting/ending with reaction emojis (`🎉`, `👍`, `👏`, `❤️`, `🔥`, `💡`, `😂`, `😮`, `😢`, `🙏`), such as `"¡Felicidades! 🎉"`, `"🎉 Me alegro mucho por ti"`, `"¡Gracias!"`, `"Thanks!"`, `"Congratulations"`, `"Congrats"`, `" Like"`, `"React"`, `"Reaccionar"`, `"Me gusta"`, `"Recomendar"`.
- D3@1 (implements R3): **Mutable Badge & Counter Scrubbing in Semantic ID Generation (`scrubMutableBadgeCounts`)**. Export a pure function `scrubMutableBadgeCounts(name: string): string` in `src/screens/screen-learn.ts` and apply it before `slugify(name)` inside `deriveIds`:
  1. Strip trailing or comma/parenthesis-separated notification/unread badge suffixes in ES/EN, e.g. `", 3 notificaciones nuevas"`, `", 1 nueva notificación"`, `", 0 nuevas notificaciones"`, `", 5 new notifications"`, `" (3 unread)"`, `" (12 mensajes no leídos)"` -> `"Notificaciones"`, `"Inicio"`, `"Mi red"`, `"Mensajes"`.
  2. Strip volatile live-metric suffixes such as `"Hace 3 horas • 377 lectores"`, `"5h ago • 1,204 readers"`, `"14 contactos han jugado"`, `"220.548 seguidores"` when deriving semantic IDs, while preserving the base label (e.g. `@notificaciones`, `@inicio`, `@mi-red`, `@mensajes`).
  3. In `src/screens/screen-merge.ts` (`matchGroup`), allow existing and learned elements of the same `role` whose scrubbed semantic slug matches (and `occurrence` matches) to pair seamlessly as a rename rather than creating duplicate zombie targets when notification counts change between `0`, `1`, and `3`.
- D4@1 (implements R4): **Exclusion of User-Shared External Links & Redirectors (`isUserContentExternalLink`)**. In `src/screens/screen-learn.ts`, exclude links (`role === "link"`) that represent user-pasted external URLs or content redirectors rather than structural app navigation:
  1. Links located inside dynamic or list/conversation containers (`feed`, `log`, `article`, `list`) whose `external === true` or whose `href` points to known user-content sharing / meeting domains (`drive.google.com`, `docs.google.com`, `meet.google.com`, `zoom.us`, `teams.microsoft.com`, `dropbox.com`, `calendly.com`, `youtu.be`, `youtube.com`, `github.com` when not on github).
  2. Any link whose accessible `name` is itself a raw URL or prefixed raw URL (e.g. `/^(?:abrir\s+|open\s+)?https?:\/\//i`, such as `"https://drive.google.com/..."`, `"https://meet.google.com/..."`, or `"Abrir https://join.com/terms"`), or whose `href` is an outbound safety redirector (`/\/safety\/go\b/i` or `?url=https%3A%2F%2F`).
- D5@1 (implements R5): **Informal Conversation List & Per-Item Action Menu Filtering (`isConversationItemControl`)**.
  1. In `src/browser/collector.ts` (`containerOf`), broaden dynamic stream detection to recognize informal chat/message scroll containers (elements with `role="list"`, `role="region"`, or `<ul>`/`<ol>` whose accessible name or `aria-label` matches conversation/messaging/thread/chat keywords in ES/EN, e.g. `/conversaci[oó]n|mensajes|messages|chat|thread|hilo/i`) as dynamic containers or preserve their `containerRole` / `containerName`.
  2. In `src/screens/screen-learn.ts`, filter out per-message / per-item action menus and attachment download buttons in conversation or list contexts (`isConversationItemControl`), specifically matching per-item menu patterns (e.g. `"Abre la lista de opciones en tu conversación con..."`, `"Open options list in your conversation with..."`, `"Más opciones para el mensaje"`, `"More actions for message"`, repeated `"Más opciones"` / `"More options"` with `occurrence >= 1`, `"Descartar empleo «...»"`, and inline file-size attachment buttons matching `/\b\d+\s*(?:KB|MB|GB|B)\b.*\b(?:descargar|download)\b/i`).

## Trade-offs & Mitigations (Principle 10)

- **Decision 1: Scrubbing mutable badge counts in `@id` while keeping raw `locator.name` vs modifying `locator.name`.**
  - *Pros*: Produces 100% stable `@id` targets (`@notificaciones`, `@mensajes`, `@inicio`) across sessions. When `mergeScreen` pairs by scrubbed ID (D3@1), re-learning updates `locator.name` in place without creating zombie `@notificaciones-1-...` and `@notificaciones-3-...` entries.
  - *Cons*: If the badge count changes *between* the last `learn` and a live semantic `click:@notificaciones` (before re-snapshot updates the map), exact `locator.name` matching in `refFor` / `findByLocator` might see `"Notificaciones, 2 notificaciones nuevas"` while the stored locator has `"Notificaciones, 1 notificación nueva"`.
  - *Mitigation*: In `src/screens/screen-resolve.ts` (`refFor`) and `src/browser/locate.ts` (`findByLocator`), add a fallback match comparing `scrubMutableBadgeCounts(found.name) === scrubMutableBadgeCounts(locator.name)` when exact `name` match fails for the same `role` and `occurrence`. This guarantees `@notificaciones` resolves live even if a new notification arrives mid-session.
- **Decision 2: Filtering anonymous checkboxes and conversation item menus vs keeping all DOM controls in `screens.json`.**
  - *Pros*: Reduces screen map size by 60–80% on complex SPAs like LinkedIn and prevents volatile viewport-dependent elements from breaking screen fingerprints and polluting agent context.
  - *Cons*: An agent cannot use a permanent `@checkbox-3` semantic ID from `screens.json` to click an unnamed row checkbox.
  - *Mitigation*: Raw snapshots (`pwa_snapshot` / `pwa_find`) are completely untouched (Rule R4 of spec 001), so every anonymous checkbox, reaction button, and shared link remains addressable via ephemeral `eN` refs or `@pattern(query)` during live interaction.
- **Decision 3: Heuristic detection of user-shared external links and redirectors vs dropping all external links.**
  - *Pros*: Preserves legitimate structural footer/header external links (such as `@help-center` -> `https://help.example.com` in `demo-app.screens.json` or `@acerca-de` -> `https://about.linkedin.com`) while eliminating pasted Google Meet/Drive URLs and `/safety/go/` redirector links.
  - *Cons*: Heuristic domain/URL-name rules must be carefully scoped so they don't accidentally drop valid navigation links.
  - *Mitigation*: Only drop links when their accessible name contains a literal `http(s)://` URL, their `href` uses an outbound redirector wrapper (`/safety/go`), they point to known ephemeral collaboration/file-sharing hosts (`drive.google.com`, `meet.google.com`, `zoom.us`, etc.), or they sit inside a dynamic message/feed container. Existing `demo-app.screens.json` golden tests verify zero regression on structural external links.

## Deliverables

- `src/screens/screen-learn.ts`: Add `scrubMutableBadgeCounts`, `isAnonymousListCheckbox`, `isQuickReactionControl`, `isUserContentExternalLink`, `isConversationItemControl`, and integrate them into `deriveIds` and `learnScreen`.
- `src/screens/screen-merge.ts`: Update `matchGroup` to pair elements whose `role`, `occurrence`, and `scrubMutableBadgeCounts(name)` match, preventing duplicate targets when badge numbers change.
- `src/screens/screen-resolve.ts` & `src/browser/locate.ts`: Add badge-scrubbed name fallback in `refFor` and `findByLocator` so semantic targets like `@notificaciones` remain actionable even when live badge counts tick up or down.
- `src/browser/collector.ts`: Enhance `containerOf` to identify informal chat/conversation scroll containers.
- `src/screens/test/screen-filtering.test.ts` & `src/screens/test/screen-learn.test.ts`: Unit and integration tests covering R1–R5.

## Sequencing

1. Implement `scrubMutableBadgeCounts` and noise filter predicates (`isAnonymousListCheckbox`, `isQuickReactionControl`, `isUserContentExternalLink`, `isConversationItemControl`) in `src/screens/screen-learn.ts`, plus informal conversation container recognition in `src/browser/collector.ts`.
2. Update `matchGroup` in `src/screens/screen-merge.ts` and locator fallback in `src/screens/screen-resolve.ts` & `src/browser/locate.ts` to support badge-scrubbed name matching.
3. Add unit and integration tests in `src/screens/test/screen-filtering.test.ts` and `src/screens/test/screen-learn.test.ts` verifying R1, R2, R3, R4, and R5 without breaking existing golden fixtures.
4. Run full CI verification (`pnpm lint && pnpm build && pnpm test && pnpm smoke`) and `python .spectrace/trace.py check`.
