# Roadmap

Index of every spec - status, dependencies, pipeline stage, and priority. Read this table first; nothing else in this repo should be needed to get oriented.

| ID | Spec | Status | Depends on | Stage | Priority |
|---|---|---|---|---|---|
| 001 | screen-map-filtering | done        | - | —     | 1 |
| 002 | multi-pwa-isolation | done        | - | —      | 2 |
| 003 | free-mode-profiles | done        | - | —            | 3 |
| 004 | standalone-pwa-no-extension | done        | - | —      | 4 |
| 005 | automatic-pwa-provisioning | done        | 004 | —      | 5 |
| 006 | retire-pwasforfirefox | done        | 004, 005 | —      | 6 |
| 007 | session-health-check | done        | 002 | —     | 7 |
| 008 | profile-lock-diagnostics | done        | 002 | —     | 8 |
| 009 | user-js-performance-tuning | done        | 004 | —     | 9 |
| 010 | profile-backup-restore | done        | 002 | —     | 10 |
| 011 | screen-map-history-discovery | done        | 001, 002 | —     | 11 |
| 012 | native-app-window-chrome | done        | 004 | —     | 12 |
| 013 | app-icon-and-desktop-shortcut | done        | 005 | —     | 13 |
| 014 | remove-pwasforfirefox-leftovers | done        | 006, 012, 013 | —     | 14 |
| 015 | managed-firefox-runtime | done        | 014 | —     | 15 |
| 016 | assisted-auth-transition | done        | 007, 008 | —     | 16 |
| 017 | code-audit-cleanup | done        | 006, 012, 016 | —      | 17 |
| 018 | canonical-app-origin-mapping | done        | 002, 004, 005 | —     | 18 |
| 019 | smart-url-app-resolution | done        | 005, 018 | —      | 19 |
| 020 | dynamic-workspace-storage | done        | 002, 018 | —      | 20 |
| 021 | automatic-auth-cookie-sync | done        | 002, 004, 016 | —      | 21 |
| 022 | audit-cleanup-and-refactor | done        | 006, 017, 019, 020 | —     | 22 |
| 023 | asset-and-media-download | done        | 002, 004, 020 | —     | 23 |
| 024 | screen-map-storage-unification | done        | 020 | —      | 24 |
| 025 | dynamic-route-parameterization | done        | 024 | —      | 25 |
| 026 | semantic-screen-noise-filtering | done        | 025 | —      | 26 |
| 027 | mcp-agent-guidance-and-system-prompt | done        | 026 | —      | 27 |
| 028 | browser-nav-canonical-renaming | done        | 027 | —      | 28 |
| 029 | tool-layer-and-contract-convergence | done        | 021, 022, 028 | —     | 29 |
| 030 | assisted-auth-fallback | done        | 029 | —     | 30 |
| 031 | package-and-docs-canonical-convergence | done        | 028, 030 | —      | 31 |
