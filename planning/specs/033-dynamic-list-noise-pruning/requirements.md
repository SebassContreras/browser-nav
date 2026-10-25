# Requirements: Dynamic List & Feed Noise Pruning (Smart Screen Map)

## Context

In complex web applications like LinkedIn, Amazon, Mercadona, or Google Search, dynamic lists (such as search result cards, item feeds, news articles, and candidate lists) render dozens or hundreds of interactive items (`role: "listitem"`, item dismiss buttons, specific job title cards, or individual bookmark toggles).

Currently, `screen-learn.ts` registers all viewport elements into permanent `@id` targets if they are buttons or links. In LinkedIn, a single job search screen registers 97 actions containing transient job titles, candidate employer names, and "Descartar empleo..." buttons, ballooning `screens.json` from ~150 lines to 4,738 lines.

This pollutes the screen map with transient zombie targets that expire on new searches, consumes massive token context (>4,000 tokens per turn), confuses autonomous agents, and destroys deterministic caching. Dynamic items must be navigated in live sessions via `browser_find({ query })`, while `screens.json` must strictly represent the application's structural skeleton.

## Requirements

- R1@1: `screen-learn.ts` MUST detect dynamic query result containers, feeds, and item collection regions (e.g. `role: "feed"`, `role: "list"`, or containers whose name indicates results/items) and MUST NOT register individual item cards or item-level actions (e.g. job card titles, "Descartar empleo...", inline item options) as permanent screen `actions[]` or `fields[]`.
- R2@1: `screen-learn.ts` MUST represent detected dynamic collections in the screen's `patterns[]` array with `dynamicChildren: true`, defining the container role, item role, and available generic action targets (e.g. `@item-card`) without persisting individual child targets.
- R3@1: Structural controls that manipulate the search, collection, or view (e.g. search input boxes, filter toggle buttons, sort comboboxes, pagination buttons, "Limpiar filtros", "Crear nuevo") MUST be preserved as permanent structural `@id` targets.
- R4@1: Content links inside dynamic result items (such as news stories, sponsored items, or third-party target links) MUST NOT be saved into `links[]` of the screen map.
- R5@1: The learned `screens.json` for any search, feed, or catalog screen MUST maintain a token-lean footprint (reducing repetitive item clutter by >80%) while maintaining strict schema validity and deterministic fingerprint hashing.
