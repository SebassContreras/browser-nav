# 015 - managed-firefox-runtime - Tasks

- [ ] T001 [agent] [status:todo] Resolver: add the managed runtime as last candidate and report the resolution source
      covers: D1@1
      changes: src/browser/pwa-runtime.ts
- [ ] T002 [agent] [status:todo] RuntimeInstaller + WindowsFirefoxInstaller (version lookup, download, SHA-512, /ExtractDir, atomic rename) and unsupported-platform installer
      covers: D2@1, D5@1
      changes: src/browser/runtime-installer.ts
- [ ] T003 [agent] [status:todo] Test: resolver order; installer with fake HTTP/process (hash mismatch, interrupted install, no system side effects)
      covers: R1@1, R3@1, R4@1, R7@1, R8@1
      kind: test
      changes: src/browser/test/pwa-runtime.test.ts, src/browser/test/runtime-installer.test.ts
- [ ] T004 [agent] [status:todo] `pwa_install_runtime` MCP tool and `pwa-nav runtime install|status` CLI
      covers: D4@1
      changes: src/mcp/mcp-tools.ts, src/cli/
- [ ] T005 [agent] [status:todo] Consent: elicitation on `pwa_open` launch without Firefox; fallback hint when unsupported or declined
      covers: D3@1
      changes: src/mcp/mcp-server.ts, src/mcp/mcp-tools.ts
- [ ] T006 [agent] [status:todo] Test: elicitation accept / decline / unsupported; CLI never installs implicitly
      covers: R5@1, R6@1
      kind: test
      changes: src/mcp/test/, src/cli/test/
- [ ] T007 [agent] [status:todo] Docs: managed runtime, consent flow, env vars
      covers: R2@1, R5@1, R6@1
      changes: docs/firefox-runtime.md, docs/mcp.md, README.md
- [ ] T008 [human] [status:todo] Resolve Q1 (build locale)
      covers: D2@1
- [ ] T009 [human] [status:todo] On a machine without Firefox: accept the prompt in an MCP client; app opens with window chrome and icon; nothing registered in installed programs or default browser
      covers: R4@1, R5@1, R9@1
