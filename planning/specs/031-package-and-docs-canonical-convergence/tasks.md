# Tasks: Package and Docs Canonical Convergence

- [x] T001 [agent] [status:done] Update package.json name to browser-nav and description, keeping bin aliases
      covers: D1@1, R1@1
      changes: package.json (+2 -2)

- [x] T002 [agent] [status:done] Update src/cli/test/cli.test.ts to verify package.json name is browser-nav and bin mappings
      covers: D5@1, R1@1, R5@1
      kind: test
      changes: src/cli/test/cli.test.ts (+5 -3)

- [x] T003 [agent] [status:done] Update AGENTS.md to canonical browser-nav identity, CLI commands, and BROWSER_NAV_* env vars
      covers: D2@1, R2@1, R3@1
      changes: AGENTS.md (+45 -36)

- [x] T004 [agent] [status:done] Update SKILL.md to canonical browser-nav identity, CLI commands, and BROWSER_NAV_* env vars
      covers: D2@1, R2@1, R3@1
      changes: SKILL.md (+53 -53)

- [x] T005 [agent] [status:done] Update README.md to canonical browser-nav identity, usage table, and BROWSER_NAV_* env vars
      covers: D3@1, R2@1, R3@1
      changes: README.md (+104 -104)

- [x] T006 [agent] [status:done] Update docs/ (mcp.md, screen-map.md, firefox-runtime.md) to browser-nav and BROWSER_NAV_*
      covers: D4@1, R3@1, R4@1
      changes: docs/firefox-runtime.md (+15 -15), docs/mcp.md (+29 -14), docs/screen-map.md (+14 -14)

- [x] T007 [agent] [status:done] Run full validation (pnpm lint, pnpm build, pnpm test, pnpm smoke) to verify zero regressions
      covers: D5@1, R5@1
      kind: test
      changes: none
