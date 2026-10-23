# Requirements: Dynamic Route Parameterization

## Context

Single Page Applications (SPAs) like LinkedIn, Gmail, and Twitter encode entity IDs, UUIDs, base64 tokens, and slugs directly in URL path segments (e.g. `/messaging/thread/2-ZjhmMGE2NDUt.../`). Currently, `screen-learn.ts` stores the literal raw `pathname`, generating a distinct duplicated screen entry for every message thread or conversation visited. Dynamic route segments must be automatically recognized and parameterized into pattern routes.

## Requirements

- R1@1: During screen learning (`screen-learn.ts`), URL path segments that match variable token patterns (UUIDs, base64 strings with padding/hyphens, numeric IDs >= 4 digits, hexadecimal hashes >= 8 characters) MUST be automatically parameterized into route parameter placeholders (e.g. `:threadId`, `:id`).
- R2@1: If an existing screen map already contains a parameterized route matching the current URL pattern, screen learning MUST treat the page as that screen rather than creating a duplicate screen entry with literal IDs.
- R3@1: Inferred route parameter names MUST be deterministic, semantic based on preceding path segments when available (e.g. segment following `thread` or `threads` becomes `:threadId`), or fallback to `:id` or `:paramN`.
- R4@1: Route matching and compact view rendering MUST evaluate parameterized routes against current URLs, successfully resolving the screen without requiring exact literal pathname equality.
