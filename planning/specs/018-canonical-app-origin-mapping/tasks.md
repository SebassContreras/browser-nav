# 018 - canonical-app-origin-mapping - Tasks

- [x] T001 [agent] [status:done] Implement pure AppRegistry domain model and FileAppRegistry in src/core/app-registry.ts
      covers: R1@1, R2@1, D1@1, D2@1
      changes: src/core/app-registry.ts (+250 -0)

- [x] T002 [agent] [status:done] Unit test AppRegistry in src/core/test/app-registry.test.ts
      covers: R1@1, R2@1, D1@1, D2@1
      kind: test
      changes: src/core/test/app-registry.test.ts (+171 -0)

- [x] T003 [agent] [status:done] Integrate AppRegistry into Gate security checks in src/core/gate.ts
      covers: R1@1, R4@1, D3@1
      changes: src/core/app-registry.ts (+7 -2), src/core/gate.ts (+16 -38)

- [x] T004 [agent] [status:done] Unit test Gate allow-list resolution in src/core/test/gate.test.ts
      covers: R1@1, R4@1, D3@1
      kind: test
      changes: src/core/test/gate.test.ts (+60 -0)

- [x] T005 [agent] [status:done] Inject AppRegistry into DefaultPwaProvisioner in src/browser/provisioner.ts
      covers: R2@1, R4@1, D4@1
      changes: src/browser/bidi-backend.ts (+2 -1), src/browser/provisioner.ts (+10 -3)

- [x] T006 [agent] [status:done] Unit test DefaultPwaProvisioner with MemoryAppRegistry in src/browser/test/provisioner.test.ts
      covers: R2@1, R4@1, D4@1
      kind: test
      changes: src/browser/test/provisioner.test.ts (+25 -0)

- [x] T007 [agent] [status:done] Implement auto-binding and explicit --app in openTool (src/tools/open.ts)
      covers: R3@1, D5@1
      changes: src/tools/open.ts (+21 -2)

- [x] T008 [agent] [status:done] Integration test openTool origin binding in src/tools/test/open.test.ts
      covers: R3@1, D5@1
      kind: test
      changes: src/tools/test/open.test.ts (+132 -0)

- [x] T009 [agent] [status:done] Verify full CI suite (lint, build, test, smoke)
      covers: R1@1, R2@1, R3@1, R4@1, D1@1, D2@1, D3@1, D4@1, D5@1
      kind: test
      changes: src/core/app-registry.ts (+5 -1), src/core/gate.ts (+1 -2), src/core/test/app-registry.test.ts (+4 -4), src/tools/test/open.test.ts (+12 -12)

- [x] T010 [human] [status:done] Migrate local .agent/apps/notebook-google-com data to notebooklm-google-com
      covers: R4@1, D1@1
      changes: none
