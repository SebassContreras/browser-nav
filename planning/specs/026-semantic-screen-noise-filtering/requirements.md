# Requirements: Semantic Screen Noise Filtering

## Context

Current screen map learning extracts transient and ephemeral viewport elements into permanent `@id` targets. This includes anonymous checkboxes in virtualized message lists, quick-reaction buttons, mutable badge counters embedded into accessible labels, and external links shared in conversation bodies. These ephemeral targets pollute the screen map and create volatile zombie targets that break repeatability.

## Requirements

- R1@1: Anonymous checkboxes (`role: "checkbox"` with empty or generic name) inside list, feed, or conversation viewports MUST NOT be registered as permanent screen targets.
- R2@1: Quick-reaction buttons (e.g. emoji affirmations such as `"¡Felicidades! 🎉"`, `"Me alegro mucho por ti"`, thumbs-up, heart reactions) MUST be recognized and excluded from permanent screen map controls.
- R3@1: Mutable badge and counter suffixes in accessible names (e.g. `"Notificaciones, 3 notificaciones nuevas"` or live reader counts) MUST have their volatile numeric count scrubbed during semantic ID generation, producing stable targets (e.g. `@notificaciones`).
- R4@1: External links pasted inside user message content or comments (e.g. Google Drive, Google Meet, Zoom, arbitrary third-party URLs) MUST NOT be classified as structural application links in the screen map.
- R5@1: Informal dynamic conversation/message lists (identified by standard container semantics or chat scroll containers) MUST NOT have individual message item action menus registered as application-level global targets.
