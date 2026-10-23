# Requirements: Screen Map Storage Unification

## Context

Screen maps historically could be persisted under `<agentDir>/screens/<appId>.screens.json` or under `<agentDir>/apps/<appSlug>/screens.json`. Furthermore, inconsistent URL slugification (e.g. keeping vs stripping `www.`) caused learned screens to be invisible to snapshots and matchers, triggering repeated `unmapped_screen` (13) and multi-map collision errors. Storage must be strictly unified per application slug.

## Requirements

- R1@1: All screen map persistence and lookups MUST target `<agentDir>/apps/<appSlug>/screens.json` as the sole canonical location per application.
- R2@1: Application slug derivation from URL or origin MUST be idempotent and uniform across all tools, stripping leading `www.` and standardizing hostname characters so that `https://www.linkedin.com` and `https://linkedin.com` produce the exact same slug.
- R3@1: Screen map loaders MUST transparently load or migrate any existing legacy map from `<agentDir>/screens/<appId>.screens.json` into `<agentDir>/apps/<appSlug>/screens.json` without failing with multi-map collision errors when both locations exist.
- R4@1: If an explicit `--screen-map <file>` or `--screens-dir <dir>` option is provided, it MUST take precedence over default storage paths without mutating unrelated application directories.
- R5@1: When running inside a repository or workspace, `resolveAgentDir` MUST consistently resolve to `<workspaceRoot>/.agent` rather than falling back to global `~/.pwa-nav`.
