import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../mcp-server.js";
import { OfflineBackend } from "../../backend/backend.js";

interface Called {
  isError: boolean;
  text: string;
  structured: Record<string, unknown>;
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<Called> {
  const result = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text?: string }[];
    structuredContent?: Record<string, unknown>;
  };
  return {
    isError: result.isError === true,
    text: result.content.map((c) => c.text ?? "").join("\n"),
    structured: result.structuredContent ?? {},
  };
}

test("E2E: dynamic workspace switching via pwa_config and per-call overrides over MCP", async () => {
  const rootTemp = await mkdtemp(join(tmpdir(), "pwa-nav-e2e-workspaces-"));
  const workspaceA = join(rootTemp, "project-alpha");
  const workspaceB = join(rootTemp, "project-beta");
  await mkdir(workspaceA, { recursive: true });
  await mkdir(workspaceB, { recursive: true });

  const mcp = createMcpServer({
    mode: "offline",
    backendFactory: ({ cacheDir }) => new OfflineBackend({ agentDir: cacheDir }),
  });

  const client = new Client({ name: "e2e-client", version: "1.0.0" });
  const [transportA, transportB] = InMemoryTransport.createLinkedPair();

  // 1. Connect client and server
  await Promise.all([mcp.connect(transportA), client.connect(transportB)]);

  try {
    // 2. Query initial configuration
    const initConfig = await call(client, "pwa_config", { action: "get" });
    assert.equal(initConfig.isError, false);
    assert.ok(initConfig.structured["agentDir"]);

    // 3. Switch workspace dynamically to project-alpha via pwa_config
    const switchRes = await call(client, "pwa_config", { action: "set", workspaceDir: workspaceA });
    assert.equal(switchRes.isError, false);
    const expectedAgentA = join(workspaceA, ".agent");
    assert.equal(switchRes.structured["updated"], true);
    assert.equal(switchRes.structured["mode"], "workspace");
    assert.equal(switchRes.structured["agentDir"], expectedAgentA);

    // 4. Perform an open operation in project-alpha
    const openResA = await call(client, "pwa_open", { url: "https://example.com" });
    assert.equal(openResA.isError, false);
    assert.ok(existsSync(join(expectedAgentA, "session.json")));

    // 5. Perform snapshot targeting project-beta via per-call workspaceDir override
    const expectedAgentB = join(workspaceB, ".agent");
    const snapResB = await call(client, "pwa_snapshot", {
      rawTree: "- button 'Submit'",
      url: "https://example.com/beta",
      workspaceDir: workspaceB,
    });
    assert.equal(snapResB.isError, false);
    assert.ok(existsSync(join(expectedAgentB, "snapshot.json")));

    // 6. Confirm that active session storage remained project-alpha
    const verifyConfig = await call(client, "pwa_config", { action: "get" });
    assert.equal(verifyConfig.isError, false);
    assert.equal(verifyConfig.structured["agentDir"], expectedAgentA);
    assert.equal(verifyConfig.structured["mode"], "workspace");
  } finally {
    await client.close();
    await mcp.close();
    await rm(rootTemp, { recursive: true, force: true });
  }
});
