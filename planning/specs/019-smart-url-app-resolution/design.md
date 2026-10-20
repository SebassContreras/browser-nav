# 019 — smart-url-app-resolution — Design

## Approach

- D1@1 (implements R1, R2, R3): Pure pre-navigation target resolution function `resolveNavigationTarget(input: string, registry?: AppRegistry): Promise<NavigationResolution>` in `src/core/target-resolution.ts`. It deterministically categorizes inputs into: (a) valid HTTP/HTTPS URLs (passed through unmodified), (b) registered app slugs from `AppRegistry` or built-in canonical web aliases (`linkedin`, `google`, `mercadona`, `github`, `twitter`, `x`) resolved to their canonical starting URL, (c) syntactically valid domain names (with recognized TLD format, e.g. `domain.tld` or `sub.domain.tld`) prepended safely with `https://`, and (d) invalid/unresolvable inputs rejected fail-fast with `PwaNavError("invalid_args")` without spawning browser processes or creating dead tabs.
- D2@1 (implements R1, R2, R3): Integration into CLI `open` (`src/cli.ts`), `openTool` (`src/tools/open.ts`), and `performOpen` (`src/ops/ops.ts`). Resolution runs before any backend initialization, ensuring that typos (e.g. `linkeding`, bare words without TLD) fail immediately with clear diagnostic hints, while valid aliases and domain shortcuts resolve cleanly to their target URLs and app slugs.
- D3@1 (implements R4): Alignment of MCP schemas and system prompts. Updates `pwa_open` tool description and `inputSchema` in `src/mcp/mcp-tools.ts`, system prompts in `src/core/instructions.ts`, `AGENTS.md`, and `SKILL.md` to document valid target formats (full URL, domain, or registered slug), explicit negative examples against bare words/typos, and guidance on error recovery.

## Trade-offs & Mitigations

- **Decision 1: Built-in canonical alias dictionary vs. purely dynamic registry.**
  - *Pros*: Instant, zero-config resolution for common services (`linkedin` -> `https://www.linkedin.com`, `google` -> `https://www.google.com`, `mercadona` -> `https://tienda.mercadona.es`, `github` -> `https://github.com`, `twitter`/`x` -> `https://x.com`).
  - *Cons*: Hardcoded dictionary could become stale or incomplete over time.
  - *Mitigation*: Dynamic `AppRegistry` (from `.agent/allow.json`) takes precedence over built-in aliases. Built-in aliases serve solely as standard sensible defaults.
- **Decision 2: Strict syntactic domain validation vs. full IANA TLD list.**
  - *Pros*: Validating standard hostnames with common TLD regex (`^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?::\d+)?(/.*)?$`) avoids bundling massive multi-megabyte IANA suffix lists, keeping runtime footprint minimal and pure.
  - *Cons*: Hypothetical non-existent TLDs like `foo.bar` would qualify syntactically for `https://` prepending.
  - *Mitigation*: Real typos from agents are typically bare words without dots (e.g. `linkeding`, `linkedin`, `notebook`), which are caught and rejected 100% reliably. Anything with a valid dot-separated TLD format gets `https://`.
- **Decision 3: Pure module in `src/core/` with anti-corruption interface.**
  - *Pros*: Zero external dependencies, pure function testable with in-memory registries without disk I/O, strict separation of concerns.
  - *Cons*: Needs wiring into both CLI argument parsing and MCP tool layer.
  - *Mitigation*: Both entry points delegate to `openTool` or use `resolveNavigationTarget`, guaranteeing identical behavior across CLI and MCP.

## Deliverables

- `src/core/target-resolution.ts`: `resolveNavigationTarget`, alias definitions, domain validation, error formatting.
- `src/core/test/target-resolution.test.ts`: Isolated unit test suite following Given-When-Then / AAA.
- `src/tools/open.ts`: Integrate target resolution into `openTool`.
- `src/cli.ts`: Integrate target resolution into `cmdOpen`.
- `src/mcp/mcp-tools.ts`: Update `pwa_open` schema, descriptions, and error hints.
- `src/tools/test/open.test.ts`: Integration tests covering resolved aliases, domain auto-completion, and fail-fast rejection.
- Documentation & prompts: `AGENTS.md`, `SKILL.md`.

## Sequencing

1. Implement core target resolution logic & unit tests (`src/core/target-resolution.ts`, `src/core/test/target-resolution.test.ts`).
2. Integrate resolution into `openTool` and `cmdOpen`.
3. Update MCP schemas, `AGENTS.md`, and `SKILL.md`.
4. Add regression & integration tests in `src/tools/test/open.test.ts`.
