import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { createBackendFactory } from "../backend-factory.js";

describe("createBackendFactory", () => {
  it("builds the backend in the request cacheDir when one is given", () => {
    const factory = createBackendFactory({ mode: "offline", cacheDir: "/startup/agent" });

    const backend = factory({ armed: false, cacheDir: "/workspace/job/.agent" });

    assert.equal(backend.agentDir, resolve("/workspace/job/.agent"));
  });

  it("falls back to the startup cacheDir when the request has none", () => {
    const factory = createBackendFactory({ mode: "offline", cacheDir: "/startup/agent" });

    const backend = factory({ armed: false });

    assert.equal(backend.agentDir, resolve("/startup/agent"));
  });
});
