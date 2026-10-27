# 002 — multi-pwa-isolation

## Goal
Multi-PWA session management and window isolation. Enable opening multiple PWAs concurrently without forcing subsequent PWAs into navigation or new tabs within an existing PWA's OS window on port 9222.
Source: GitHub issue #4.

## Requirements
- R1: Opening a second PWA while another PWA is already listening on port 9222 allocates an independent debugging port (e.g. 9223+) or isolates the launch so the apps do not collide or cross-navigate.
- R2: Each launched PWA maintains its own standalone OS window instance instead of opening as a tab or replacing the location of an existing PWA window.
- R3: CLI and MCP tools allow targeting a specific active PWA instance via `--app` or `--port` without ambiguous session hijacking.
- R4: Releasing or closing a BiDi session for one PWA does not terminate or invalidate connections to other active PWA instances.
- R5: Active debugging ports and their associated app slugs are tracked cleanly and freed when the browser process exits.

### Who it serves
Agents and developers running multiple web apps simultaneously (e.g., WhatsApp and LinkedIn) who need each application to live in its own independent desktop window with dedicated debugging lifecycle.

### Out of scope
- Synchronizing browser state, cookies, or localStorage across isolated PWA instances.
- Supporting browsers other than Firefox PWA runtime and standard Firefox.

### Dependencies
- None.

### Owner split
Agent: code, tests, docs. Human: verification with multiple concurrent live PWA launches.

## Design
### Approach

- D1 (R1, R5): Allocate dynamic debugging ports sequentially starting at DEFAULT_PORT (9222) via an injectable PortAllocator service that checks port availability via TCP probe and active registry entries. _(standard: W3C WebDriver BiDi — https://w3c.github.io/webdriver-bidi/)_
- D2 (R2): Launch each PWA as an independent OS process using its dedicated standalone profile directory (.agent/apps/<appSlug>/profile) and its assigned BiDi port. _(standard: Firefox Standalone PWA)_
- D3 (R3): Introduce a persistent, atomic InstanceRegistry (.agent/instances.json) mapping appSlug to active instance metadata (port, pid, url, startedAt), enabling target resolution by --app <slug> or --port <n>. _(standard: Service Registry Pattern)_
- D4 (R3): Expose --app and --port parameters across CLI commands and MCP tool calls to route operations to the corresponding active PWA instance. _(judgement, no standard)_
- D5 (R4, R5): Implement health-check and stale instance pruning that frees ports and removes registry entries when a process terminates or no longer listens on its port. _(judgement, no standard)_

### Deliverables

- `src/browser/port-allocator.ts`: Port allocation utility and collision avoidance.
- `src/browser/instance-registry.ts`: `PwaInstanceRegistry` interface and file-backed implementation.
- Updates to `src/browser/standalone-runner.ts` and `src/browser/bidi-backend.ts` for multi-port routing.
- Updates to `src/tools/`, `src/cli/`, and `src/mcp/` to accept `--app` and `--port`.
- Automated test suites for port allocation, registry, and concurrent multi-app isolation.

### Sequencing

1. `PortAllocator` and `InstanceRegistry` services and unit tests.
2. Integration into standalone launcher and backend resolution.
3. CLI and MCP parameter wiring.
4. Concurrency integration tests and manual verification.

## Tasks
- [x] 002/T001 [agent] Define PwaInstanceRegistry interface and PortAllocator utility — covers D1, R1
- [x] 002/T002 [agent] Unit tests for port allocation and probe collision avoidance — covers D1, R1
- [x] 002/T003 [agent] Implement file-backed InstanceRegistry with atomic sync and stale pruning — covers D3, D5, R3, R5
- [x] 002/T004 [agent] Unit tests for InstanceRegistry lifecycle and stale pruning — covers D3, D5, R3, R5
- [x] 002/T005 [agent] Integrate PortAllocator and InstanceRegistry into launchStandaloneApp — covers D2, R2
- [x] 002/T006 [agent] Support app and port target resolution in BidiBackend and tools — covers D4, R3, R4
- [x] 002/T007 [agent] Wire --app and --port flags into CLI and MCP adapters — covers D4, R3
- [x] 002/T008 [agent] Integration test for concurrent isolated PWA instances — covers D2, D4, R2, R4
- [ ] 002/T009 [human] Manual verification of launching two concurrent live PWAs in separate OS windows — covers R1, R2, R3, R4, R5
