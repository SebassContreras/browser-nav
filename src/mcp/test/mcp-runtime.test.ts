// Spec 015 consent flow: pwa_open --launch without Firefox asks via elicitation, never downloads silently.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema, type ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import type { Backend } from "../../backend/backend.js";
import { FirefoxNotFoundError } from "../../browser/pwa-runtime.js";
import type { InstallResult, RuntimeInstaller } from "../../browser/runtime-installer.js";
import { createMcpServer } from "../mcp-server.js";
import { RUNTIME_INSTALL_PROMPT } from "../mcp-tools.js";

interface Harness {
  installs: number;
  prompts: string[];
  call: (name: string, args: Record<string, unknown>) => Promise<{ isError: boolean; text: string }>;
}

async function withRuntimeMcp(
  elicitation: ElicitResult["action"] | "unsupported" | "fails",
  fn: (h: Harness) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-mcp-runtime-"));
  let installed = false;
  const harness = { installs: 0, prompts: [] as string[] } as Harness;
  const installer: RuntimeInstaller = {
    install(): Promise<InstallResult> {
      harness.installs++;
      installed = true;
      return Promise.resolve({ version: "158.0", binary: join(dir, "firefox.exe"), bytes: 95_000_000 });
    },
    installedVersion: () => Promise.resolve(installed ? "158.0" : undefined),
  };
  // Fake backend: launching fails until the runtime is installed.
  const backend = {
    agentDir: dir,
    open: (url: string) => {
      if (!installed) return Promise.reject(new FirefoxNotFoundError("win32"));
      return Promise.resolve({ url, title: "App", context: "ctx" });
    },
  } as unknown as Backend;
  const server = createMcpServer({ backendFactory: () => backend, runtimeInstaller: installer, cacheDir: dir, log: () => undefined });
  const client = new Client(
    { name: "test", version: "1" },
    { capabilities: elicitation === "unsupported" ? {} : { elicitation: { form: {} } } },
  );
  if (elicitation !== "unsupported") {
    client.setRequestHandler(ElicitRequestSchema, (request) => {
      harness.prompts.push(request.params.message);
      if (elicitation === "fails") throw new Error("Tool execution interrupted");
      return elicitation === "accept" ? { action: "accept", content: { confirm: true } } : { action: elicitation };
    });
  }
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  harness.call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return { isError: result.isError === true, text: content.map((c) => c.text).join("\n") };
  };
  try {
    await fn(harness);
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const OPEN = { url: "https://app.test/", launch: true };

test("pwa_open --launch without Firefox: accepted elicitation installs, then opens", async () => {
  await withRuntimeMcp("accept", async (h) => {
    const result = await h.call("pwa_open", OPEN);
    assert.equal(result.isError, false, result.text);
    assert.deepEqual(h.prompts, [RUNTIME_INSTALL_PROMPT]);
    assert.equal(h.installs, 1);
  });
});

for (const action of ["decline", "cancel", "fails"] as const) {
  test(`pwa_open --launch without Firefox: ${action} never downloads and returns no_browser`, async () => {
    await withRuntimeMcp(action, async (h) => {
      const result = await h.call("pwa_open", OPEN);
      assert.equal(result.isError, true);
      assert.match(result.text, /pwa_install_runtime/);
      assert.equal(h.prompts.length, 1);
      assert.equal(h.installs, 0);
    });
  });
}

test("client without elicitation: no prompt, no download, hint to call pwa_install_runtime", async () => {
  await withRuntimeMcp("unsupported", async (h) => {
    const result = await h.call("pwa_open", OPEN);
    assert.equal(result.isError, true);
    assert.match(result.text, /pwa_install_runtime/);
    assert.equal(h.installs, 0);

    const install = await h.call("pwa_install_runtime", {});
    assert.equal(install.isError, false, install.text);
    assert.match(install.text, /firefox 158\.0 installed/);
    assert.equal(h.installs, 1);
    assert.equal((await h.call("pwa_open", OPEN)).isError, false);
  });
});

test("pwa_open without launch never prompts", async () => {
  await withRuntimeMcp("accept", async (h) => {
    const result = await h.call("pwa_open", { url: "https://app.test/" });
    assert.equal(result.isError, true);
    assert.equal(h.prompts.length, 0);
    assert.equal(h.installs, 0);
  });
});
