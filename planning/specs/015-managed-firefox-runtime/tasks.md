# 015 - managed-firefox-runtime - Tasks

- [x] T001 [agent] [status:done] Resolver: add the managed runtime as last candidate and report the resolution source
      covers: D1@1
      changes: src/browser/pwa-runtime.ts
- [x] T002 [agent] [status:done] RuntimeInstaller + WindowsFirefoxInstaller (version lookup, download, SHA-512, /ExtractDir, atomic rename) and unsupported-platform installer
      covers: D2@1, D5@1
      changes: src/browser/runtime-installer.ts
- [x] T003 [agent] [status:done] Test: resolver order; installer with fake HTTP/process (hash mismatch, interrupted install, no system side effects)
      covers: R1@1, R3@1, R4@1, R7@1, R8@1
      kind: test
      changes: src/browser/test/pwa-runtime.test.ts, src/browser/test/runtime-installer.test.ts
- [x] T004 [agent] [status:done] `pwa_install_runtime` MCP tool and `pwa-nav runtime install|status` CLI
      covers: D4@1
      changes: src/mcp/mcp-tools.ts, src/tools/runtime.ts, src/cli.ts
- [x] T005 [agent] [status:done] Consent: elicitation on `pwa_open` launch without Firefox; fallback hint when unsupported or declined
      covers: D3@1
      changes: src/mcp/mcp-server.ts, src/mcp/mcp-tools.ts
- [x] T006 [agent] [status:done] Test: elicitation accept / decline / unsupported; CLI never installs implicitly
      covers: R5@1, R6@1
      kind: test
      changes: src/mcp/test/mcp-runtime.test.ts, src/mcp/test/mcp-server.test.ts, src/mcp/test/mcp.stdio.test.ts, src/mcp/test/mcp.bidi.stdio.test.ts
- [x] T007 [agent] [status:done] Docs: managed runtime, consent flow, env vars
      covers: R2@1, R5@1, R6@1
      changes: docs/firefox-runtime.md, docs/mcp.md, README.md
- [x] T008 [human] [status:done] Resolve Q1 (build locale): en-US
      covers: D2@1
- [x] T009 [human] [status:done] On a machine without Firefox: accept the prompt in an MCP client; app opens with window chrome and icon; nothing registered in installed programs or default browser
      covers: R4@1, R5@1, R9@1
