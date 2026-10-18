# 018 - canonical-app-origin-mapping - Requirements

## What's being built

A canonical application and multi-origin mapping system integrated into `.agent/allow.json` and the core resolution pipeline.
It allows applications spanning multiple origins, subdomains, or redirects (such as `notebook.google.com` redirecting to `notebooklm.google.com`, `twitter.com` vs `x.com`, or `tienda.mercadona.es` vs `mercadona.es`) to share a single canonical `appSlug`. This converges Firefox standalone profiles (`profile/`), persistent screen maps (`screens.json`), cookies, and history under a unified `.agent/apps/<canonicalSlug>/` directory instead of fracturing across multiple hostname folders.

## Who it serves

Users and automated agents interacting with complex, multi-domain, or redirected web applications without experiencing fragmented sessions, split authentication states, or disconnected screen maps.

## Requirements

- R1@1: Multi-origin mapping in `allow.json`: extend `.agent/allow.json` to declare canonical app entities (`apps: { <slug>: { origins: string[] } }`) while preserving full backward compatibility with legacy flat `origins: string[]` arrays.
- R2@1: Canonical slug resolution: resolve application slugs hierarchically by consulting mapped origins in `.agent/allow.json` first, falling back to deterministic hostname slugging (`appSlugFromUrl`) only when unmapped.
- R3@1: Automatic redirection aliasing & explicit binding: during `open`, automatically associate navigation redirect origins with the canonical destination slug in `.agent/allow.json` (excluding auth login barriers like `accounts.google.com`), and support explicit binding via `--app <slug>`.
- R4@1: Unified profile and screen map convergence: ensure `PwaProvisioner`, `Backend`, and CLI/MCP tool operations direct profile creation, lock checking, and screen map reads/writes to the resolved canonical app folder.

## Out of scope

- Arbitrary cross-domain credential leakage across unrelated top-level domains without origin consent.
- Scraping external web manifest files dynamically from unverified third-party hosts.

## Dependencies

- 002 (multi-pwa-isolation: `.agent/apps/<slug>/profile` directory structure).
- 004 (standalone-pwa-no-extension: security gate and `allow.json`).
- 005 (automatic-pwa-provisioning: `PwaProvisioner` and slug resolution).

## Owner split

Agent: service interfaces, registry implementation, gate integration, provisioner integration, openTool auto-aliasing, tests. Human: verify single-folder execution with real multi-origin web apps.
