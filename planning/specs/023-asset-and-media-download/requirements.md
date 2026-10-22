# 023 - asset-and-media-download - Requirements

## What's being built

An on-demand download and asset extraction capability (`pwa_download` MCP tool and `pwa-nav download` CLI command) allowing users and agents to explicitly fetch or extract remote and in-page assets (images, inline SVGs, videos, audio, and documents). The tool operates strictly on demand (never automatically/implicitly during snapshots or navigation), supports authenticated asset fetching using the active PWA browser session cookies/headers, extracts inline DOM `<svg>` nodes into clean `.svg` files, and enforces destination boundary security to keep downloads safe.

## Who it serves

Developers, QA testers, and AI agents automating or inspecting web apps that require downloading or extracting visible media assets (like generated videos, charts, SVG icons, or user attachments) strictly when requested.

## Requirements

- R1@1: On-demand download by direct URL: When requested explicitly via CLI (`pwa-nav download <url> [--out <path>]`) or MCP (`pwa_download({ url, dest })`), download the target remote asset into a designated workspace directory (defaulting to `./downloads/` or specified safe path).
- R2@1: On-demand extraction and download by DOM target / element ref: When an in-page element is targeted (via semantic `@id`, element `ref`, or CSS/XPath query targeting `<img>`, `<video>`, `<audio>`, `<a>`, or `<source>`), resolve its source URL (`src` or `href`) within the active browser session and download it.
- R3@1: Inline SVG extraction: When the targeted DOM element is an inline `<svg>` element (or contains one), extract its serialized XML markup directly from the page DOM and write it as a formatted `.svg` file.
- R4@1: Authenticated session context download: When downloading URLs from protected/login-walled PWAs, fetch through the browser session (or transfer active session cookies/headers) so that authentication is preserved and bot-walls/anti-hotlinking defenses do not block the download.
- R5@1: Safe storage boundaries & path validation: Reject attempts to write files outside of allowed directories (enforcing the same boundary principles as file uploads: workspace root or `.agent/downloads/`), prohibiting path traversal (`..`) or writing into sensitive system locations.
- R6@1: Strictly non-automatic operation: The download mechanism must never trigger automatically during `snapshot`, `open`, or browsing actions. It must only execute when the user or agent explicitly calls `pwa_download` or `pwa-nav download`.
- R7@1: MCP schema and CLI parity: Expose `pwa_download` in the MCP tool registry with clear schemas and parameter descriptions, and wire `pwa-nav download` into the CLI with informative progress/output.

## Out of scope

- Automatic scraping or batch crawling of all media on every page load.
- Video stream re-encoding, transcoding, or DRM stripping (Widevine/FairPlay).
- Background torrenting or resumable multi-gigabyte chunked downloading.

## Dependencies

- 002 (multi-pwa-isolation)
- 004 (standalone-pwa-no-extension)
- 020 (dynamic-workspace-storage)

## Owner split

Agent: implementation of download service, BiDi extraction, CLI/MCP adapters, tests, documentation. Human: verification on target web apps.
