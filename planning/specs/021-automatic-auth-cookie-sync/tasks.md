# 021 — automatic-auth-cookie-sync — Tasks

- [x] T001 [agent] [status:done] Default Firefox profile locator and profiles.ini parser
      covers: R1@1, D1@1
      changes: src/browser/firefox-profile-discovery.ts (+192 -0), src/core/test/storage.test.ts (+1 -1), src/mcp/mcp-server.ts (+5 -4), src/mcp/test/mcp-server.test.ts (+6 -4), src/mcp/test/mcp-workspace.test.ts (+1 -1), src/mcp/test/mcp.bidi.stdio.test.ts (+2 -1), src/mcp/test/mcp.stdio.test.ts (+1 -1), src/tools/common.ts (+0 -1), src/tools/config.ts (+8 -1), src/tools/test/config.test.ts (+1 -1)
- [x] T002 [agent] [status:done] Unit tests for Firefox profile discovery across platforms
      covers: R1@1, D1@1
      kind: test
      changes: src/browser/test/firefox-profile-discovery.test.ts (+163 -0)
- [x] T003 [agent] [status:done] SQLite cookie extractor with temporary copy lock-bypass
      covers: R1@1, D2@1
      changes: src/browser/cookie-extractor.ts (+175 -0)
- [x] T004 [agent] [status:done] Unit tests for cookie extraction and domain filtering
      covers: R1@1, D2@1
      kind: test
      changes: src/browser/test/cookie-extractor.test.ts (+127 -0)
- [x] T005 [agent] [status:done] Cookie sync service with BiDi storage.setCookie and cold seeding
      covers: R2@1, R4@1, D3@1
      changes: src/browser/cookie-sync.ts (+186 -0)
- [x] T006 [agent] [status:done] Unit & integration tests for cookie sync and BiDi injection
      covers: R2@1, D3@1
      kind: test
      changes: src/browser/test/cookie-sync.test.ts (+121 -0)
- [x] T007 [agent] [status:done] Integrate automatic cookie seeding into PWA provisioner and openTool
      covers: R2@1, D3@1
      changes: src/browser/provisioner.ts (+23 -0)
- [x] T008 [agent] [status:done] Deprecate manual clean/restart workflow and refactor authTool to auto-sync
      covers: R3@1, R5@1, D4@1, D5@1
      changes: src/ops/ops.ts (+33 -18)
- [x] T009 [agent] [status:done] Verification tests for automated pwa_auth and security barrier preservation
      covers: R3@1, R5@1, D4@1, D5@1
      kind: test
      changes: src/tools/test/auth-sync.test.ts (+40 -0)
