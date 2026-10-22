import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { configTool } from "../config.js";
import { openTool } from "../open.js";
import { snapshotTool } from "../snapshot.js";
import type { ToolContext, BackendRequest } from "../types.js";
import { OfflineBackend, type Backend } from "../../backend/backend.js";

async function withTmp(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = join(tmpdir(), `pwa-nav-config-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function makeMockContext(initialDir: string): ToolContext {
  return {
    backendFactory: (req: BackendRequest): Backend => {
      return new OfflineBackend({ agentDir: req.cacheDir ?? initialDir });
    },
    armed: false,
    mode: "offline",
    screens: { cacheDir: initialDir, screensDir: join(initialDir, "screens") },
    agentDir: initialDir,
  };
}

describe("configTool and performConfig", () => {
  it("inspects active configuration in get mode", async () => {
    await withTmp(async (dir) => {
      const ctx = makeMockContext(dir);
      const res = await configTool({ action: "get" }, ctx);

      assert.equal(res.structured["mode"], "custom");
      assert.equal(res.structured["agentDir"], dir);
      assert.equal(res.structured["screensDir"], join(dir, "screens"));
      assert.match(res.text ?? "", /Active configuration:/);
    });
  });

  it("dynamically updates active cacheDir and mutates context on set mode", async () => {
    await withTmp(async (dir) => {
      const ctx = makeMockContext(dir);
      const newCache = join(dir, "new-cache");

      const res = await configTool({ action: "set", cacheDir: newCache }, ctx);

      assert.equal(res.structured["updated"], true);
      assert.equal(res.structured["agentDir"], newCache);
      assert.equal(ctx.agentDir, newCache);
      assert.equal(ctx.screens.cacheDir, newCache);
      assert.equal(ctx.screens.screensDir, join(newCache, "screens"));
      assert.match(res.text ?? "", /Configuration updated:/);
    });
  });

  it("dynamically updates workspaceDir and converts to <workspaceDir>/.agent", async () => {
    await withTmp(async (dir) => {
      const ctx = makeMockContext(dir);
      const workspaceDir = join(dir, "my-workspace");

      const res = await configTool({ action: "set", workspaceDir }, ctx);

      const expectedAgentDir = join(workspaceDir, ".agent");
      assert.equal(res.structured["updated"], true);
      assert.equal(res.structured["mode"], "workspace");
      assert.equal(res.structured["agentDir"], expectedAgentDir);
      assert.equal(res.structured["workspaceDir"], workspaceDir);
      assert.equal(ctx.agentDir, expectedAgentDir);
      assert.equal(ctx.screens.cacheDir, expectedAgentDir);
    });
  });

  describe("per-call workspace overrides across tools", () => {
    it("openTool targets overridden workspaceDir without altering session context", async () => {
      await withTmp(async (dir) => {
        const defaultAgent = join(dir, "default-agent");
        const overrideWorkspace = join(dir, "override-project");
        await mkdir(defaultAgent, { recursive: true });
        await mkdir(overrideWorkspace, { recursive: true });

        const ctx = makeMockContext(defaultAgent);

        const openRes = await openTool(
          { url: "https://example.com", workspaceDir: overrideWorkspace },
          ctx,
        );

        assert.equal(openRes.structured["url"], "https://example.com");
        const expectedOverrideAgent = join(overrideWorkspace, ".agent");
        assert.ok(existsSync(join(expectedOverrideAgent, "session.json")));
        assert.ok(!existsSync(join(defaultAgent, "session.json")));

        // Global context remains unchanged
        assert.equal(ctx.agentDir, defaultAgent);
        assert.equal(ctx.screens.cacheDir, defaultAgent);
      });
    });

    it("snapshotTool targets overridden cacheDir without altering session context", async () => {
      await withTmp(async (dir) => {
        const defaultAgent = join(dir, "default-agent");
        const overrideCache = join(dir, "override-cache");
        await mkdir(defaultAgent, { recursive: true });
        await mkdir(overrideCache, { recursive: true });

        const ctx = makeMockContext(defaultAgent);

        const snapRes = await snapshotTool(
          { rawTree: "- link 'Home'", url: "https://example.com", title: "Test", cacheDir: overrideCache },
          ctx,
        );

        assert.ok(snapRes.structured["snapshotId"]);
        assert.ok(existsSync(join(overrideCache, "snapshot.json")));
        assert.ok(!existsSync(join(defaultAgent, "snapshot.json")));

        // Global context remains unchanged
        assert.equal(ctx.agentDir, defaultAgent);
        assert.equal(ctx.screens.cacheDir, defaultAgent);
      });
    });
  });
});
