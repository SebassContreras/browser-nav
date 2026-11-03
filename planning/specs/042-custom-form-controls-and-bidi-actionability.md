# 042 — custom-form-controls-and-bidi-actionability

## Goal
Enable reliable automation of modern customized form controls and client-side URL routing over WebDriver BiDi: `browser-nav` must allow actionability and clicking on visually-hidden native `<input type="checkbox">` and `<input type="radio">` through their associated visible `<label>`, support declarative option selection for `<select>` tags in `browser_fill`, and tolerate client-side query-string rewriting in `assertFresh` / `sameDocumentUrl`. Verified by unit tests and end-to-end integration tests.

## Requirements
- R1: Visually-hidden checkbox and radio button actionability: when an `<input type="checkbox">` or `<input type="radio">` has zero dimensions (`width === 0 || height === 0`) or is visually clipped/hidden (e.g. `class="visually-hidden"`), `checkActionable` and `locate` inspect its associated `<label>` (via `el.labels`, wrapping `<label>`, or `label[for="..."]`). If the label is visible and unobstructed, actionability passes and clicking targets the label. Partitions: (a) checkbox with wrapping `<label>`, (b) checkbox with `label[for]`, (c) visible native checkbox, (d) checkbox with disabled/hidden label. Invariants: a truly invisible/detached checkbox with no visible label is rejected with `element is not visible`; clicking the label toggles the checkbox state.
- R2: Declarative option selection on `<select>` elements in `prepareFill` / `fill`: `browser_fill` supports `<select>` elements by matching the input text against option labels and values (case-insensitive substring and exact matches), setting `select.value`, and dispatching standard `change` and `input` events. Partitions: (a) text matches option label, (b) text matches option value, (c) text matches partially, (d) text matches no option. Invariants: `<select>` is never rejected with `select is not supported by fill`; an unmatchable option value fails with an actionable error message; readback verifies the selected option.
- R3: Resilient URL matching in `sameDocumentUrl`: `sameDocumentUrl` tolerates URL query-string parameter additions, deletions, and ordering changes when the origin and pathname are identical (e.g. SPA client-side tracking parameters). Partitions: (a) query params stripped by SPA router, (b) query params added by SPA router, (c) pathname changes, (d) origin changes. Invariants: genuine page navigations to different routes still raise `StaleRefError`; SPA tracking query changes do not invalidate live element references.

## Design
- D1 (R1): In `src/browser/actions.ts:checkActionable`, if `el.localName === "input"` and `type` is `"checkbox"` or `"radio"`, look up its associated label (`(el as HTMLInputElement).labels?.[0] || el.closest("label") || (el.id ? el.ownerDocument.querySelector('label[for="' + el.id + '"]') : null)`). If the input is not directly visible but the label is visible, evaluate actionability against the label. In `LOCATE_NODE_SOURCE`, return the label when the input is styled hidden so BiDi pointer actions target the visible click target. *(Source: observed LinkedIn Easy Apply step 3 Workable ATS checkboxes)*.
- D2 (R2): In `src/browser/actions.ts:prepareFill`, remove the blanket rejection for `<select>`. For `tag === "select"`, mark `kind: "select"`, focus the element, find the option matching `text` (by exact label, exact value, or substring), set `select.value = matched.value`, and dispatch `change` and `input` events. In `readBackMatches`, read `(el as HTMLSelectElement).selectedOptions[0]?.text || (el as HTMLSelectElement).value`. *(Source: observed SmartAssets 4452434425 screening dropdowns)*.
- D3 (R3): In `src/browser/locate.ts:sameDocumentUrl`, parse both URLs using `new URL(url)` and compare `origin + pathname`. If pathname and origin match, return `true`, ignoring fragment and query parameters. *(Source: observed LinkedIn SPA URL tracking parameter rewriting / Finding F-009)*.

## Trade-offs & Mitigations
- **D1 (Label Delegation vs Forcing Direct Input Clicks):**
  - *Pros:* Matches actual human interaction in modern web frameworks (Tailwind, Artdeco, Material) where native inputs are hidden for custom styling.
  - *Cons:* If a label covers multiple inputs, ambiguity could arise.
  - *Mitigation:* Restrict lookup to `el.labels[0]`, explicit `for=id` match, or closest ancestor `label`.
- **D2 (JavaScript Value Setting & Event Dispatch vs Native Key Navigation for `<select>`):**
  - *Pros:* Native OS select menus cannot be driven via cross-platform BiDi mouse actions; setting `value` and dispatching `change`/`input` reliably triggers React/Vue/Angular state bindings.
  - *Cons:* Bypasses native keyboard arrow navigation.
  - *Mitigation:* Dispatch both `input` and `change` bubbling events to ensure complete DOM listener compatibility.
- **D3 (Origin + Pathname Equality vs Full URL Equality):**
  - *Pros:* Prevents spurious `StaleRefError` when SPAs rewrite tracking, referral, or state query parameters without changing the document or page layout.
  - *Cons:* Multi-view SPAs where different views are keyed purely by query parameters (e.g. `?tab=settings`) might be considered same document.
  - *Mitigation:* If the DOM actually mutates, role/name locator count checks in `assertFresh` catch element disappearance regardless.

## Tasks
- [ ] 042/T001 [agent] Implement `<label>` delegation for visually-hidden checkbox and radio actionability in `src/browser/actions.ts` with unit tests — covers R1, D1
- [ ] 042/T002 [agent] Implement declarative `<select>` option selection in `prepareFill` and `readBackMatches` in `src/browser/actions.ts` with unit tests — covers R2, D2
- [ ] 042/T003 [agent] Update `sameDocumentUrl` in `src/browser/locate.ts` to compare origin and pathname, ignoring query string churn — covers R3, D3
- [ ] 042/T004 [agent] Rebuild `dist/mcp.js` (`pnpm build`) and run test suite (`pnpm test`) — covers R1, R2, R3

## Changes
- 2026-11-03: Spec created following the live LinkedIn Easy Apply integration audit. Resolved hidden checkbox actionability, combobox option selection via fill, and SPA query-string ref invalidation.
