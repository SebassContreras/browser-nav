# Testing Standards & Verification Guidelines

This document governs testing philosophy, invariants, input partitioning, and test hygiene. AI agents must follow it when writing tests or auditing the suite.

---

## ▶️ Commands

| Command | What it runs |
|---|---|
| `pnpm test` | `tsx --test "src/**/*.test.ts"` — unit and integration suites (Node test runner) |
| `pnpm smoke` | `node ./scripts/smoke.ts` — smoke verification of the built CLI |
| `pnpm lint` / `pnpm build` | ESLint / TypeScript build |
| CI gate | `pnpm lint && pnpm build && pnpm test && pnpm smoke` |
| Firefox E2E | `src/test/e2e.test.ts` — opt-in, needs a real Firefox with BiDi on `9222` |

Tests live in each module's `test/` subdirectory or colocated beside the unit (`src/<module>/**/*.test.ts`). Never mark a task done without running the CI gate.

---

## 🧪 Invariants & Input Partitioning

### 1. Assert contracts, not anecdotes
Key invariants of this repo:
- Safety gate: armed actions abort on kill-switch, blocked origins, sensitive targets, and unsafe upload paths — with the exact exit code from [DESIGN.md](./DESIGN.md).
- Refs: any mutation invalidates `eN` refs (`stale_ref`); `@id` targets resolve through the screen map.
- Screen maps: every written map validates against `schemas/screen-map.schema.json`; learn/merge is idempotent.
- Error taxonomy: each `PwaNavError` code maps to exactly one exit code.

### 2. Systematic input partitioning
Cover nominal values, boundaries (±1), malformed/empty inputs (`""`, `[]`, `undefined`, wrong types), and compound errors. For paths: traversal (`..`), sensitive names (`.env*`, keys), outside-workspace.

### 3. Root-cause regressions
When fixing a bug, assert the violated equivalence class across every entry point (CLI and MCP through `src/tools/`), not just the reported payload.

### 4. State transitions
Assert lifecycles: BiDi session open → release in `finally`; snapshot → mutate → stale; dry-run vs armed.

---

## 🧼 Test Hygiene

1. **AAA:** Arrange, Act, Assert; behavioral test names (`rejects upload outside workspace with file_upload_blocked`).
2. **Table-driven:** matrices of inputs as arrays of cases with explicit descriptions.
3. **No branching in tests:** no `if`/ternaries/manual loops inside test bodies beyond iterating a case table.
4. **Mock only at boundaries:** use the fake BiDi server (`src/bidi/`) and `OfflineBackend` instead of a real browser; mock clock/filesystem only when non-deterministic. Never mock the unit under test.
5. **Deterministic:** no network, no real Firefox, no sleeps in the default suite; real-browser checks belong to the opt-in E2E.
