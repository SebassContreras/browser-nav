# Engineering Principles & Code Standards

This document defines the craftsmanship and code quality standards for this repository. AI agents must apply these principles proportionally to prevent code rot, over-engineering, and architectural drift.

---

## ⚙️ Core Engineering Principles

### 1. KISS / YAGNI — No Over-Engineering
- Do not create interfaces, adapters, or abstractions for a single use case or a hypothetical future.
- Introduce an abstraction **only** with 2+ concrete uses, 2+ implementations (e.g. `OfflineBackend` / `BidiBackend`), or a genuine test seam.
- Simple > clever. Never invent stack requirements.

### 2. SRP / Separation of Concerns
- One file / module = one responsibility. Respect the layers in [ARCHITECTURE.md](./ARCHITECTURE.md): domain in `src/core/`, screen maps in `src/screens/`, protocol in `src/bidi/`, browser adapters in `src/browser/`, use cases in `src/ops/`, service layer in `src/tools/`, transport in `src/cli/` and `src/mcp/`.

### 3. DRY via Composition, Not Inheritance
- Extract shared logic into small functions or services; CLI and MCP share behavior through `src/tools/`, never by copying.

### 4. Service Layer + Anti-Corruption / Dependency Inversion (DIP)
- Domain code never calls BiDi, the filesystem, or vendor SDKs directly; it goes through the `Backend` port and adapters.

### 5. Follow the Stack's Standards
- TypeScript `strict: true`, ESM with explicit import extensions, `module/moduleResolution: nodenext`.
- 2-space indent. ESLint (`pnpm lint`); no formatter is configured.
- Casing: `kebab-case` files, `PascalCase` types/classes, `camelCase` functions/variables, `UPPER_SNAKE_CASE` constants.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

### 6. Document Trade-offs
- Record pros, cons, and mitigations of significant choices in the relevant spec or [CHANGES.md](./CHANGES.md).

### 7. Validate with Research — Only When It Changes the Decision
- Research is not a ritual. Look it up only when at least one holds:
  - the choice is hard to reverse (file format, protocol, public surface, contract shape);
  - the answer is a fact outside this repository (WebDriver BiDi specification, browser version behaviour, MCP protocol rules, platform limits, licence terms);
  - two credible options tie and the tie-break is factual, not stylistic.
- Do not research what a root contract already states, what the stack's own documentation defines, or a local, reversible change you can settle by running it.
- Source order: official specification or documentation, then maintainer issue or release notes, then vendor blog. One or two sources per question; stop when a primary source settles it.
- Cite what you used where the decision lives — `D<n>` in the spec, a code comment, or `CHANGES.md` — as `Source: <url> (accessed YYYY-MM-DD)`.
- A non-obvious claim that could have a source and has none is a review finding.

---

## 🔒 Hard Rules (Non-Overridable)

1. **Lawful use only:** no CAPTCHA/bot-wall bypass, no credential automation.
2. **Language:** code comments and docs in English; chat with the user in Spanish.
3. **PowerShell targets:** always quote semantic targets (`'@id'`, `click:'@id'`).
4. **Context economy:** never dump binary images or base64 into LLM context; save to disk and report `{path, width, height}`. Never paste full snapshots inline.
5. **Fail-fast refs:** re-snapshot after every mutation; stale refs fail with a re-snapshot instruction.
6. **Upload boundary:** file uploads restricted to the workspace root and `.agent/`, no path traversal.
7. **Secrets:** never commit secrets, `.env` files, or cookies.

The rest of this document consists of overridable defaults.
