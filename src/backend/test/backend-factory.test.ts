import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { createBackendFactory } from "../backend-factory.js";
import type { BidiBackendOptions } from "../../browser/bidi-backend.js";

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

  it("propagates contextId with request winning over startup defaults", () => {
    const factory = createBackendFactory({ mode: "bidi", port: 9222, contextId: "c-default" });

    const defaultBackend = factory({ armed: false }) as unknown as { options: BidiBackendOptions };
    assert.equal(defaultBackend.options.contextId, "c-default");

    const overrideBackend = factory({ armed: false, contextId: "c-override" }) as unknown as { options: BidiBackendOptions };
    assert.equal(overrideBackend.options.contextId, "c-override");
  });
});
