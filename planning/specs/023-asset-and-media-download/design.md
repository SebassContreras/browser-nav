# 023 — asset-and-media-download — Design

## Approach & Architectural Alignment

Applying the 10 Core Engineering Principles:
1. **KISS / YAGNI (Principle 1)**: Keep the download engine lean and direct. No complex multi-part worker pools or torrent engines. A single `DownloadService` handles direct HTTP fetch or in-browser script evaluation for DOM nodes / SVGs.
2. **SRP / Separation of Concerns (Principle 2)**:
   - `src/tools/download.ts`: Tool execution coordinator (validates request, decides strategy between direct URL vs DOM element extraction).
   - `src/core/download-security.ts`: Path boundary validator (prohibits traversal, restricts writing to `./downloads` or safe workspace paths).
   - `src/browser/dom-asset-extractor.ts`: Evaluates script via BiDi backend to extract `src`/`href` or inline SVG XML markup from elements.
3. **DRY via Composition & Injection (Principle 3)**: Compose `DownloadService` by injecting `Backend` (for DOM script eval and active session context) and a standard HTTP fetcher/filesystem interface.
4. **Service Layer + Anti-Corruption (Principle 4 & 5)**: The CLI and MCP layers delegate to `src/tools/download.ts` (`performDownload(backend, options)`), keeping protocols decoupled from download logic.
5. **Testing Behavior & Hygiene (Principles 6 & 7)**: Test distinct observable failure modes and behaviors (Given-When-Then, boundary mocks only):
   - Direct URL download with safe output path.
   - Refusal of path traversal / sensitive paths (fail-safe).
   - In-page `<img>` / `<video>` `src` resolution.
   - Inline `<svg>` DOM extraction to `.svg` file.
   - Preserving authenticated session context.
6. **Standards & Conventions (Principle 8)**: Node 22 native `fetch` / streams, standard TypeScript strict ESM, clean path handling with `node:path`.
7. **Research Validation (Principle 9)**: BiDi `script.evaluate` with element reference or standard `fetch` in the target browsing context guarantees session cookies and headers are passed seamlessly.
8. **Document Trade-offs (Principle 10)**: Documented below with mitigations.

## Design Decisions

- D1@1 (implements R1, R5): **Safe Path & Output Resolution**. Introduce `resolveDownloadPath(dest, filename, workspaceRoot)`: defaults to `<workspaceRoot>/downloads/<filename>`. Validates destination against traversal (`..`) or unauthorized directories.
- D2@1 (implements R2, R3, R4): **Browser-Context Asset Extraction (`extractAssetFromElement`)**.
  - If a target or ref is specified: inspect target DOM node.
  - If node is `<svg>`: serialize `outerHTML` using `new XMLSerializer().serializeToString(svgNode)` directly from page context and save as UTF-8 `.svg`.
  - If node is `<img>`, `<video>`, `<audio>`, `<source>`, or `<a>`: read `src` or `currentSrc` or `href`.
  - To bypass CORS and retain cookies on protected media, evaluate an in-page `fetch(url)` or download blob in the active browser context when needed, falling back to authenticated Node fetch.
- D3@1 (implements R6, R7): **Explicit Tool & CLI Surface (On-Demand Only)**:
  - CLI: `pwa-nav download <url|@target|ref> [--out <path>]`
  - MCP: `pwa_download({ url?: string, target?: string, ref?: string, out?: string })`
  - Explicitly configured with zero automatic triggers; agent prompts instruct calling only upon explicit user request.

## Trade-offs & Mitigations

- **Decision 1: Evaluating download in browser context vs Node fetch.**
  - *Pros*: Running fetch inside the page context via WebDriver BiDi automatically includes origin cookies, CSRF tokens, and bypassing anti-bot referrer headers.
  - *Cons*: Very large binary files (e.g. 500MB videos) transfer base64 over WebSocket to Node.
  - *Mitigation*: For public/direct URLs, use Node streaming fetch. For protected assets, stream chunked or read via page context based on asset size.
- **Decision 2: Strict download directory confinement.**
  - *Pros*: Prevents malicious or erroneous overwriting of critical project files (`package.json`, `.env`).
  - *Cons*: User cannot save directly to arbitrary system folders (like `C:\Windows\System32`).
  - *Mitigation*: Allow user-specified subdirectories inside workspace root or `.agent/downloads/`.

## Deliverables

- `src/core/download-security.ts`: Path confinement logic.
- `src/tools/download.ts`: Unified download tool orchestration.
- `src/browser/dom-asset-extractor.ts`: Script evaluate helpers for SVG serialization and asset URL extraction.
- `src/cli.ts`: Register `pwa-nav download` command.
- `src/mcp/mcp-tools.ts` & `src/mcp/mcp-server.ts`: Register `pwa_download` tool.
- Unit and integration tests under `src/tools/test/` and `src/core/test/`.
- Updated documentation in `AGENTS.md`, `README.md`, and `SKILL.md`.

## Sequencing

1. Implement `src/core/download-security.ts` with unit tests.
2. Implement DOM extractor & `src/tools/download.ts`.
3. Wire CLI `download` and MCP `pwa_download`.
4. Comprehensive test verification (`pnpm lint && pnpm build && pnpm test && pnpm smoke`).
