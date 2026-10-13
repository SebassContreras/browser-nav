# 015 - managed-firefox-runtime - Design

## Approach

- D1@1 (implements R1, R2): Extend `resolveFirefoxBinary` (`src/browser/pwa-runtime.ts`) with the managed runtime as the last candidate (`managedRuntimeBinary(platform, env)`, `PWA_NAV_RUNTIME_DIR` override). Stays pure; also returns the source (`override` | `installed` | `managed`) for `runtime status`.
- D2@1 (implements R3, R4, R7, R9): `RuntimeInstaller` interface (`src/browser/runtime-installer.ts`): `install(onProgress?) → { version, binary, bytes }`. `WindowsFirefoxInstaller` composes an injected HTTP client (fetch wrapper) and process runner (spawn wrapper): read `LATEST_FIREFOX_VERSION` from `https://product-details.mozilla.org/1.0/firefox_versions.json`, download `https://archive.mozilla.org/pub/firefox/releases/<v>/win64/en-US/Firefox Setup <v>.exe` to a temp file, verify SHA-512 against `.../releases/<v>/SHA512SUMS`, run `<setup>.exe /ExtractDir=<staging>`, then rename `<staging>/core` into the runtime dir. Other platforms: `UnsupportedPlatformInstaller` throws `no_browser` with a manual-install hint. _(standard: Mozilla full installer options - https://firefox-source-docs.mozilla.org/browser/installer/windows/installer/FullConfig.html; same pattern as Playwright MCP's `browser_install` / `playwright install`)_
- D3@1 (implements R5): Consent lives in the MCP layer only (`src/mcp/`). When `pwa_open` with `launch: true` finds no Firefox: if the client advertises the `elicitation` capability, call `server.elicitInput` (SDK 1.31) with a boolean `confirm` schema; on accept run the installer and retry the launch. On decline, cancel, or no capability, return `no_browser` with hint `call pwa_install_runtime`. The CLI never installs implicitly.
- D4@1 (implements R6): `pwa_install_runtime` tool (`src/mcp/mcp-tools.ts`) and `pwa-nav runtime install|status` CLI commands, thin wrappers over `RuntimeInstaller` and the resolver.
- D5@1 (implements R8): Map network, hash and extraction failures to `PwaNavError` (`no_browser` with hints).

## Pros / cons and mitigations

| Con | Mitigation |
|---|---|
| ~80 MB download | Only with consent (elicitation or tool approval); progress reported |
| Supply-chain risk of downloading a binary | HTTPS to Mozilla hosts only; SHA-512 check against `SHA512SUMS` |
| Managed runtime does not self-update | Re-run `pwa_install_runtime`; `runtime status` shows the version |
| Not every MCP client supports elicitation | Fallback: `no_browser` + `pwa_install_runtime`, gated by the client's tool approval |
| Different installers per OS | Windows first behind `RuntimeInstaller`; others get a manual-install hint |

## Deliverables

- `src/browser/pwa-runtime.ts` (D1), `src/browser/runtime-installer.ts` (D2, D5).
- `src/mcp/mcp-tools.ts`, `src/mcp/mcp-server.ts` (D3, D4); CLI `runtime` command (D4).
- Tests: resolver order; installer with fake HTTP/process (hash ok/mismatch, atomic rename, interrupted install); elicitation accept/decline/unsupported.
- Docs: `docs/firefox-runtime.md`, `docs/mcp.md`, `README.md`.

## Sequencing

D1 → D2 (+D5) → D4 → D3.

## Open questions

- Q1: Locale of the downloaded build (`en-US` fixed vs. system locale). Recommendation: `en-US`; the browser UI is hidden and web content uses the page's own locale.
