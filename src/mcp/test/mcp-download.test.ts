import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../mcp-server.js";
import { OfflineBackend } from "../../backend/backend.js";

test("mcp-server: exposes pwa_download tool in tool list", async () => {
  const backend = new OfflineBackend({ agentDir: resolve("./.agent") });
  const server = createMcpServer({
    backendFactory: () => backend,
    mode: "offline",
    armed: false,
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  const tools = await client.listTools();
  const downloadTool = tools.tools.find((t) => t.name === "pwa_download");
  assert.ok(downloadTool, "pwa_download tool must be present in MCP tool list");
  assert.match(downloadTool.description ?? "", /Download a remote media asset/);

  // Call pwa_download with url in dry-run mode
  const res = (await client.callTool({
    name: "pwa_download",
    arguments: { url: "https://example.com/logo.svg" },
  })) as {
    content: { type: string; text?: string }[];
  };
  const textContent = res.content.map((c) => c.text ?? "").join("\n");
  assert.match(textContent, /download (dry-run|ok)/);

  await client.close();
  await server.close();
});
