# 041 — tolerant-flow-map-selection

## Goal
One unreadable screen map must not disable every flow and journey tool. The MCP server loads what it can, reports what it skipped, and picks a single map with a precedence rule that never depends on directory listing order.

## Requirements
- R1: Directory scanning tolerates invalid maps. Partitions: (a) a `*.screens.json` with invalid JSON, (b) a map failing schema validation, (c) a map with ambiguous routes, (d) a missing directory, (e) a directory with no maps. Invariants: with a tolerant callback the invalid file is reported and skipped while every other map still loads; without the callback the strict behaviour (throw) is unchanged for the CLI path.
- R2: Flow and journey tools are built from exactly one map, chosen deterministically. Precedence: workspace-local over global fallback directory, then canonical `apps/<slug>/screens.json` over flat `*.screens.json`, then lexical path order. Invariants: the same inputs always select the same map; when several valid maps are considered the server logs one line naming the chosen path; `--screen-map` still wins over any directory scan.
- R3: The server always starts, with or without flow tools. Invariants: a map-less start exposes the core tools and the snapshot resource; a start with valid maps adds the flow tools and the screen resource without changing the core tool names.
- R4: Tool descriptions state the real execution mode. Invariants: flow and journey descriptions say the tool executes live unless the operator launched the server with `--dry-run`; no description claims a default dry run.

## Design
- D1 (R1): `loadScreenMapsFromDir(dir, { agentDir?, onInvalid? })` keeps per-file error isolation; `onInvalid(path, error)` is called for each skipped map. Without `onInvalid` the first error propagates, so callers that must be strict stay strict. *(Source: `src/screens/screen-match.ts`)*.
- D2 (R2): `preferFlowMap(maps)` filters to local maps when any exist, then to canonical `apps/<slug>/screens.json` when any exist, then sorts by path and takes the first. *(Source: existing precedence rule in spec 039 for screen lookup)*.
- D3 (R3): `loadFlowSource` in `src/mcp/mcp-flows.ts` never throws: it logs each invalid map, logs the multi-map choice, and returns `undefined` when nothing valid remains, which leaves the core tool set untouched.
- D4 (R4): `buildFlowTools` / journey tool descriptions in `src/mcp/mcp-flows.ts` use "Executes live unless the server operator launched it with `--dry-run`", matching `armed = !isDryRun` in `src/mcp.ts`. *(Source: `src/mcp.ts` arming logic)*.

## Tasks
- [x] 041/T001 [agent] Add `onInvalid` to `loadScreenMapsFromDir` so a bad sibling map is reported and skipped — covers R1, D1
- [x] 041/T002 [agent] Add `preferFlowMap` with local-over-global and canonical-over-flat precedence — covers R2, D2
- [x] 041/T003 [agent] Make `loadFlowSource` never throw, log each skipped map, and log the chosen path when several maps are valid — covers R2, R3, D1, D2, D3
- [x] 041/T004 [agent] Correct flow and journey descriptions to state the real execution mode — covers R4, D4
- [x] 041/T005 [agent] Extend MCP server tests for invalid JSON, schema-invalid, ambiguous and missing maps, and assert the core tools and snapshot resource still exist — covers R1, R2, R3, R4

## Changes
- 2026-11-03: Spec created after a scan that returned more than one candidate map (or a stale sibling) made `browser-nav-mcp` start without any flow or journey tools. Previously the loader required exactly one valid map, so one broken file silently removed the whole flow surface.
