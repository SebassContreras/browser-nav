import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  findProjectRoot,
  resolveAgentDir,
  resolveAppScreenMapPath,
  resolveScreensDir,
  resolveWorkspaceAgentDir,
  resolveEffectiveStorage,
} from "../storage.js";

async function withTmp(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = join(tmpdir(), `pwa-nav-storage-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("storage and root detection", () => {
  it("finds project root by .git marker", async () => {
    await withTmp(async (root) => {
      const gitDir = join(root, ".git");
      const subDir = join(root, "a", "b", "c");
      await mkdir(gitDir, { recursive: true });
      await mkdir(subDir, { recursive: true });

      assert.equal(findProjectRoot(subDir), root);
    });
  });

  it("finds project root by package.json marker", async () => {
    await withTmp(async (root) => {
      await writeFile(join(root, "package.json"), "{}");
      const subDir = join(root, "packages", "core");
      await mkdir(subDir, { recursive: true });

      assert.equal(findProjectRoot(subDir), root);
    });
  });

  it("finds project root by .agent marker", async () => {
    await withTmp(async (root) => {
      await mkdir(join(root, ".agent"), { recursive: true });
      const subDir = join(root, "nested");
      await mkdir(subDir, { recursive: true });

      assert.equal(findProjectRoot(subDir), root);
    });
  });

  it("resolves the cache dir from an explicit cacheDir", () => {
    assert.equal(resolveAgentDir({ cacheDir: "/custom/cache" }), resolve("/custom/cache"));
  });

  it("resolves the cache dir from PWA_NAV_CACHE_DIR only", async () => {
    assert.equal(resolveAgentDir({}, { PWA_NAV_CACHE_DIR: "/env/cache" }), resolve("/env/cache"));
    // The removed PWA_NAV_AGENT_DIR alias is ignored.
    await withTmp(async (root) => {
      await writeFile(join(root, "package.json"), "{}");
      assert.equal(resolveAgentDir({}, { PWA_NAV_AGENT_DIR: "/env/agent" }, root), join(root, ".agent"));
    });
  });

  it("resolves agentDir to <projectRoot>/.agent inside a project", async () => {
    await withTmp(async (root) => {
      await writeFile(join(root, "package.json"), "{}");
      const sub = join(root, "sub");
      await mkdir(sub, { recursive: true });

      assert.equal(resolveAgentDir({}, {}, sub), join(root, ".agent"));
    });
  });

  it("resolves screensDir to absolute path with explicit options or env", () => {
    assert.equal(resolveScreensDir({ screensDir: "my-screens" }, {}), resolve(process.cwd(), "my-screens"));
    assert.equal(resolveScreensDir({}, { PWA_NAV_SCREENS_DIR: "env-screens" }), resolve(process.cwd(), "env-screens"));
  });

  it("resolves screensDir defaulting to <cache-dir>/screens", async () => {
    await withTmp(async (root) => {
      await writeFile(join(root, "package.json"), "{}");
      assert.equal(resolveScreensDir({}, {}, root), join(root, ".agent", "screens"));
      assert.equal(
        resolveScreensDir({ cacheDir: "/custom/agent" }, {}, root),
        join(resolve("/custom/agent"), "screens"),
      );
    });
  });

  it("defaults to <cache-dir>/screens even if a legacy ./screens dir exists on disk", async () => {
    await withTmp(async (root) => {
      await writeFile(join(root, "package.json"), "{}");
      const legacyScreens = join(root, "screens");
      await mkdir(legacyScreens, { recursive: true });

      assert.equal(resolveScreensDir({}, {}, root), join(root, ".agent", "screens"));
    });
  });

  it("unifies all document outputs under custom cacheDir without loose files", async () => {
    await withTmp(async (custom) => {
      const absCustom = resolve(custom);
      assert.equal(resolveAgentDir({ cacheDir: custom }), absCustom);
      assert.equal(resolveScreensDir({ cacheDir: custom }), join(absCustom, "screens"));

      // Verify that refs and snapshots unify under custom agentDir
      const { save, load, latestSnapshotId } = await import("../refs.js");
      const snapId = await save(
        { snapshotId: "snap-custom", url: "https://custom.test", title: "Custom", elements: [] },
        { agentDir: absCustom },
      );
      assert.equal(await latestSnapshotId({ agentDir: absCustom }), snapId);
      const loaded = await load(snapId, { agentDir: absCustom });
      assert.equal(loaded?.snapshotId, "snap-custom");

      // Verify session unifies under custom agentDir
      const { OfflineBackend } = await import("../../backend/backend.js");
      const backend = new OfflineBackend({ agentDir: absCustom });
      await backend.open("https://custom.test");

      const { existsSync } = await import("node:fs");
      assert.ok(existsSync(join(absCustom, "session.json")));
      assert.ok(existsSync(join(absCustom, "snapshot.json")));
      assert.ok(existsSync(join(absCustom, "refs", `${snapId}.json`)));
    });
  });

  it("resolves workspace agent dir cleanly with resolveWorkspaceAgentDir", () => {
    assert.equal(resolveWorkspaceAgentDir("/my/project"), resolve("/my/project", ".agent"));
  });

  it("resolves agentDir from explicit workspaceDir", () => {
    assert.equal(resolveAgentDir({ workspaceDir: "/workspace/root" }), resolve("/workspace/root", ".agent"));
  });

  it("prioritizes cacheDir over workspaceDir when both are given", () => {
    assert.equal(
      resolveAgentDir({ cacheDir: "/custom/cache", workspaceDir: "/workspace/root" }),
      resolve("/custom/cache"),
    );
  });

  describe("resolveEffectiveStorage", () => {
    it("resolves mode 'custom' when cacheDir is provided", () => {
      const res = resolveEffectiveStorage({ cacheDir: "/custom/cache" }, {}, "/cwd");
      assert.equal(res.agentDir, resolve("/custom/cache"));
      assert.equal(res.screensDir, join(resolve("/custom/cache"), "screens"));
      assert.equal(res.mode, "custom");
      assert.equal(res.workspaceDir, null);
    });

    it("resolves mode 'workspace' when workspaceDir is provided", () => {
      const res = resolveEffectiveStorage({ workspaceDir: "/workspace/project" }, {}, "/cwd");
      assert.equal(res.agentDir, resolve("/workspace/project", ".agent"));
      assert.equal(res.screensDir, join(resolve("/workspace/project", ".agent"), "screens"));
      assert.equal(res.workspaceDir, resolve("/workspace/project"));
      assert.equal(res.mode, "workspace");
    });

    it("resolves mode 'custom' when PWA_NAV_CACHE_DIR environment variable is set", () => {
      const res = resolveEffectiveStorage({}, { PWA_NAV_CACHE_DIR: "/env/cache" }, "/cwd");
      assert.equal(res.agentDir, resolve("/env/cache"));
      assert.equal(res.mode, "custom");
    });

    it("resolves mode 'workspace' when inside project root with package.json", async () => {
      await withTmp(async (root) => {
        await writeFile(join(root, "package.json"), "{}");
        const sub = join(root, "src");
        await mkdir(sub, { recursive: true });

        const res = resolveEffectiveStorage({}, {}, sub);
        assert.equal(res.agentDir, join(root, ".agent"));
        assert.equal(res.workspaceDir, root);
        assert.equal(res.mode, "workspace");
      });
    });

    it("resolves mode 'fallback' to ~/.pwa-nav when outside any project", async () => {
      await withTmp((isolated) => {
        const res = resolveEffectiveStorage({}, {}, isolated);
        assert.equal(res.mode, "fallback");
        assert.equal(res.workspaceDir, null);
        assert.ok(res.agentDir.endsWith(".pwa-nav"));
      });
    });

    it("resolveAppScreenMapPath produces canonical path under apps/<appSlug>/screens.json", () => {
      const canonical = resolveAppScreenMapPath(join("mock", "agent"), "my-app");
      assert.equal(canonical, join("mock", "agent", "apps", "my-app", "screens.json"));
    });
  });
});
