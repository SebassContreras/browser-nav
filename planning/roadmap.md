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
