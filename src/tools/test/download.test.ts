import assert from "node:assert/strict";
import { rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { PwaNavError } from "../../core/errors.js";
import { downloadTool } from "../download.js";
import type { ToolContext } from "../types.js";
import { OfflineBackend } from "../../backend/backend.js";

const testDir = resolve("./temp-test-download");

function createTestContext(armed = true): ToolContext {
  const backend = new OfflineBackend({ agentDir: join(testDir, ".agent") });
  return {
    backendFactory: () => backend,
    backend,
    armed,
    mode: "offline",
    screens: { workspaceDir: testDir },
    agentDir: join(testDir, ".agent"),
  };
}

test("downloadTool: requires url, target, or ref", async () => {
  const ctx = createTestContext();
  await assert.rejects(
    async () => downloadTool({}, ctx),
    (err: unknown) => err instanceof PwaNavError && err.code === "invalid_args",
  );
});

test("downloadTool: dry-run on direct URL previews path without fetching", async () => {
  const ctx = createTestContext(false);
  const outcome = await downloadTool({ url: "https://example.com/asset.png" }, ctx);
  assert.match(outcome.text ?? "", /download dry-run: would download https:\/\/example\.com\/asset\.png/);
  const data = outcome.structured as { kind: string } | undefined;
  assert.equal(data?.kind, "dry-run");
});

test("downloadTool: offline element extraction creates mock file when armed", async () => {
  const ctx = createTestContext(true);
  const outPath = join(testDir, "downloads", "my-icon.svg");
  const outcome = await downloadTool({ target: "@logo-icon", out: outPath }, ctx);
  assert.match(outcome.text ?? "", /download ok: extracted asset from @logo-icon/);
  const written = await readFile(outPath, "utf8");
  assert.match(written, /<svg xmlns=/);
  await rm(testDir, { recursive: true, force: true });
});
