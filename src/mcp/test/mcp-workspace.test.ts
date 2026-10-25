import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, SNAPSHOT_RESOURCE_URI } from "../mcp-server.js";
import { buildFlowTools } from "../mcp-flows.js";
import type { ToolContext } from "../../tools/types.js";
import { createBackendFactory } from "../../backend/backend-factory.js";
import type { RawElement } from "../../browser/collector.js";
import { learnScreen } from "../../screens/screen-learn.js";
import type { ScreenMap } from "../../screens/screen-map.js";

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

  const startupDir = join(rootTemp, "startup", ".agent");
  const mcp = createMcpServer({
    mode: "offline",
    cacheDir: startupDir,
    backendFactory: createBackendFactory({ mode: "offline", cacheDir: startupDir }),
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

const ORIGIN = "http://localhost:8080";

function searchMapText(): string {
  const raw: RawElement[] = [
    { role: "textbox", name: "Query", nameSource: "label", occurrence: 0, inputType: "text" },
    { role: "button", name: "Search", nameSource: "content", occurrence: 0, buttonType: "submit" },
  ];
  const screen = learnScreen(raw, { url: `${ORIGIN}/search`, title: "Search", appOrigin: ORIGIN }, { access: "public" });
  screen.flows = [
    {
      id: "search",
      description: "Search for a term.",
      humanOnly: false,
      inputSchema: { type: "object", required: ["q"], properties: { q: { type: "string" } }, additionalProperties: false },
      steps: [
        { op: "fill", target: "@query", from: "q" },
        { op: "click", target: "@search" },
      ],
    },
  ];
  const map: ScreenMap = {
    schemaVersion: "1.0.0",
    app: { id: "synthetic", name: "Synthetic", origin: ORIGIN, locale: "en", learnedAt: "2026-10-01T00:00:00Z" },
    screens: [screen],
  };
  return JSON.stringify(map);
}

async function withWorkspaceServer(
  fn: (env: { client: Client; workspace: string; startupDir: string }) => Promise<void>,
): Promise<void> {
  const rootTemp = await mkdtemp(join(tmpdir(), "browser-nav-032-"));
  const startupDir = join(rootTemp, "startup", ".agent");
  const workspace = join(rootTemp, "job");
  await mkdir(workspace, { recursive: true });
  const mcp = createMcpServer({
    mode: "offline",
    cacheDir: startupDir,
    log: () => undefined,
    backendFactory: createBackendFactory({ mode: "offline", cacheDir: startupDir }),
  });
  const client = new Client({ name: "e2e-client", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([mcp.connect(a), client.connect(b)]);
  try {
    await fn({ client, workspace, startupDir });
  } finally {
    await client.close();
    await mcp.close();
    await rm(rootTemp, { recursive: true, force: true });
  }
}

test("open after browser_config set writes the session in the new workspace, not the startup dir", async () => {
  await withWorkspaceServer(async ({ client, workspace, startupDir }) => {
    await call(client, "browser_config", { action: "set", workspaceDir: workspace });

    const opened = await call(client, "browser_open", { url: `${ORIGIN}/other` });

    assert.equal(opened.isError, false, opened.text);
    assert.ok(existsSync(join(workspace, ".agent", "session.json")));
    assert.equal(existsSync(join(startupDir, "session.json")), false);
  });
});

test("flow tool asks the backend factory for the session's active .agent dir", async () => {
  const requested: (string | undefined)[] = [];
  const factory = createBackendFactory({ mode: "offline", cacheDir: "/startup/.agent" });
  const ctx: ToolContext = {
    backendFactory: (req) => {
      requested.push(req.cacheDir);
      return factory(req);
    },
    armed: false,
    mode: "offline",
    screens: { cacheDir: "/workspace/job/.agent" },
    agentDir: "/workspace/job/.agent",
  };
  const [flow] = buildFlowTools(JSON.parse(searchMapText()) as ScreenMap, () => undefined).tools;
  assert.ok(flow !== undefined);

  await flow.handler({ q: "term" }, ctx).catch(() => undefined);

  assert.equal(requested[0], "/workspace/job/.agent");
});

test("snapshot resource reads the latest snapshot from the workspace set by browser_config", async () => {
  await withWorkspaceServer(async ({ client, workspace }) => {
    await call(client, "browser_config", { action: "set", workspaceDir: workspace });
    await call(client, "browser_snapshot", { rawTree: "- button 'Submit'", url: `${ORIGIN}/form` });
    const expected = await readFile(join(workspace, ".agent", "snapshot.json"), "utf8");

    const resource = await client.readResource({ uri: SNAPSHOT_RESOURCE_URI });

    assert.equal((resource.contents[0] as { text?: string }).text, expected);
  });
});
