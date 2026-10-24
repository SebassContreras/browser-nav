import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  openTool,
  downloadTool,
  clickTool,
  fillTool,
  uploadTool,
  findTool,
  extractTool,
  waitTool,
  screenshotTool,
  authTool,
  qaTool,
  learnTool,
  type ToolContext,
} from "../index.js";
import { executeLearn } from "../learn.js";
import { OfflineBackend } from "../../backend/backend.js";
import { performSnapshot } from "../../ops/ops.js";

function makeOfflineContext(armed = false): ToolContext {
  const backend = new OfflineBackend();
  return {
    backendFactory: () => backend,
    backend,
    armed,
    mode: "offline",
    screens: {},
  };
}

test("openTool validates url and offline limitations", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => openTool({ url: "" }, ctx),
    /missing <url>/,
  );
  await assert.rejects(
    async () => openTool({ url: "https://example.com", launch: true }, ctx),
    /require the live backend/,
  );
  const result = await openTool({ url: "https://example.com" }, ctx);
  assert.equal(result.structured["url"], "https://example.com");
  assert.match(result.text ?? "", /open ok: https:\/\/example\.com/);
});

test("authTool handles relay errors", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => authTool({ app: "nonexistent-app-xyz" }, ctx),
    /requires the live backend/,
  );
});

test("clickTool and fillTool reject invalid target/ref combinations", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => clickTool({}, ctx),
    /pass target/,
  );
  await assert.rejects(
    async () => clickTool({ target: "@btn", ref: "e1" }, ctx),
    /pass either target or ref, not both/,
  );
  await assert.rejects(
    async () => fillTool({ text: "abc" }, ctx),
    /pass target/,
  );
});

test("uploadTool requires non-empty files array", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => uploadTool({ target: "@upload", files: [] }, ctx),
    /missing files to upload/,
  );
});

test("findTool and extractTool accept query with proper defaults", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tools-test-"));
  const ctx = makeOfflineContext();
  ctx.backend = new OfflineBackend({ agentDir: dir });
  await performSnapshot("- button \"Sign in\" [ref=e1]", {
    url: "http://localhost:8080/login",
    title: "Demo",
    outPath: join(dir, "snapshot.json"),
    agentDir: dir,
    quiet: true,
  });

  const findResult = await findTool({ query: "Sign" }, ctx);
  assert.equal(findResult.structured["total"], 1);

  const extractResult = await extractTool({ mode: "text" }, ctx);
  assert.equal(extractResult.structured["total"], 1);
  await rm(dir, { recursive: true, force: true });
});

test("waitTool requires either target or query", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => waitTool({}, ctx),
    /must pass either target or query/,
  );
});

test("screenshotTool returns path on offline backend", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tools-test-"));
  const ctx = makeOfflineContext();
  ctx.backend = new OfflineBackend({ agentDir: dir });
  const result = await screenshotTool({ outPath: join(dir, "screen.png") }, ctx);
  assert.ok(result.structured["path"]);
  await rm(dir, { recursive: true, force: true });
});

test("qaTool requires checkFile", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => qaTool({ checkFile: "" }, ctx),
    /missing <check-file>/,
  );
});

test("learnTool: offline mode rejects live learning", async () => {
  const ctx = makeOfflineContext();
  await assert.rejects(
    async () => learnTool({ locale: "en" }, ctx),
    /--learn needs the live backend/,
  );
});

test("executeLearn: targets canonical app screen map path and respects explicit screenMap precedence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tools-learn-test-"));
  try {
    const fakeBackend = {
      agentDir: dir,
      currentUrl: () => Promise.resolve("https://example.com/app"),
      open: () => Promise.resolve({ url: "https://example.com/app", title: "Example App", openedAt: "" }),
      collect: () => Promise.resolve({
        url: "https://example.com/app",
        title: "Example App",
        raw: [
          { role: "button", name: "Submit", disabled: undefined, nameSource: "content" as const, occurrence: 0 },
          { role: "textbox", name: "Username", disabled: undefined, nameSource: "label" as const, occurrence: 0 },
        ],
      }),
      click: () => Promise.resolve({ kind: "done" as const, plan: "", snapshotId: "1", url: "", title: "" }),
      fill: () => Promise.resolve({ kind: "done" as const, plan: "", snapshotId: "1", url: "", title: "" }),
      upload: () => Promise.resolve({ kind: "done" as const, plan: "", snapshotId: "1", url: "", title: "" }),
      act: () => Promise.resolve({ snapshotId: "1", results: [] }),
      screenshot: () => Promise.resolve(Buffer.from("")),
    };

    // 1. Default canonical app persistence under <agentDir>/apps/<slug>/screens.json
    const defaultRes = await executeLearn(fakeBackend, { locale: "en" });
    assert.equal(defaultRes.path, join(dir, "apps", "example-com", "screens.json"));

    // 2. Explicit --screen-map takes absolute precedence
    const explicitPath = join(dir, "custom-explicit.screens.json");
    const explicitRes = await executeLearn(fakeBackend, { locale: "en", screenMap: explicitPath });
    assert.equal(explicitRes.path, explicitPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});



test("downloadTool enforces safety gate and kill switch", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tools-download-gate-test-"));
  const prevKillEnv = process.env.PWA_NAV_KILL_SWITCH;
  try {
    const backend = new OfflineBackend({ agentDir: dir });
    const ctx: ToolContext = {
      backendFactory: () => backend,
      backend,
      armed: true,
      mode: "offline",
      screens: { cacheDir: dir },
      agentDir: dir,
    };

    // Kill switch enforcement via env var
    const killFile = join(dir, "kill");
    await writeFile(killFile, "halt", "utf8");
    process.env.PWA_NAV_KILL_SWITCH = killFile;
    await assert.rejects(
      () => downloadTool({ url: "https://example.com/file.png" }, ctx),
      (err: unknown) => typeof err === "object" && err !== null && "code" in err && err.code === "kill_switch",
    );
    delete process.env.PWA_NAV_KILL_SWITCH;
    await unlink(killFile);

    // Unallowed origin without consent
    await assert.rejects(
      () => downloadTool({ url: "https://unauthorized-origin.com/file.png" }, ctx),
      (err: unknown) => typeof err === "object" && err !== null && "code" in err && err.code === "origin_blocked",
    );
  } finally {
    if (prevKillEnv !== undefined) {
      process.env.PWA_NAV_KILL_SWITCH = prevKillEnv;
    } else {
      delete process.env.PWA_NAV_KILL_SWITCH;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("backend-factory: creates backend with app port lookup from FileInstanceRegistry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backend-app-test-"));
  try {
    const { FileInstanceRegistry } = await import("../../browser/instance-registry.js");
    const { createBackend } = await import("../../backend/backend-factory.js");
    const registry = new FileInstanceRegistry({ cacheDir: dir });
    await registry.register({
      appSlug: "my-app",
      url: "https://my-app.test", profileDir: join(dir, "profile"), startedAt: new Date().toISOString(),
      port: 9333,
      pid: 1234,
    });

    // createBackend with app resolves port 9333
    const backend = createBackend({
      mode: "bidi",
      app: "my-app",
      cacheDir: dir,
    });
    assert.equal((backend as unknown as { port: number }).port, 9333);

    // Explicit port takes precedence over registry app
    const backendExplicit = createBackend({
      mode: "bidi",
      app: "my-app",
      port: 9444,
      cacheDir: dir,
    });
    assert.equal((backendExplicit as unknown as { port: number }).port, 9444);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
