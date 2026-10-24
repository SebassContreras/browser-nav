import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authTool } from "../auth.js";
import type { AssistedAuthOptions } from "../../ops/auth-workflow.js";

describe("authTool fallback and assisted login orchestration", () => {
  it("invokes orchestrator when clean mode is explicitly requested", async () => {
    let orchestratorCalledWith: AssistedAuthOptions | undefined;
    const mockOrchestrator = {
      execute: (options: AssistedAuthOptions) => {
        orchestratorCalledWith = options;
        return Promise.resolve();
      },
    };

    const outcome = await authTool(
      { app: "notebook", clean: true, port: 9555, timeoutMs: 120000 },
      { mode: "bidi" },
      { orchestrator: mockOrchestrator },
    );

    assert.ok(orchestratorCalledWith !== undefined);
    assert.equal(orchestratorCalledWith.appSlug, "notebook");
    assert.equal(orchestratorCalledWith.port, 9555);
    assert.equal(orchestratorCalledWith.timeoutMs, 120000);
    assert.equal(outcome.structured["status"], "authenticated");
    assert.equal(outcome.structured["assisted"], true);
    assert.equal(outcome.structured["port"], 9555);
  });

  it("invokes orchestrator when action is 'clean'", async () => {
    let called = false;
    const mockOrchestrator = {
      execute: () => {
        called = true;
        return Promise.resolve();
      },
    };

    const outcome = await authTool(
      { app: "https://example.com/app", action: "clean" },
      { mode: "bidi" },
      { orchestrator: mockOrchestrator },
    );

    assert.equal(called, true);
    assert.equal(outcome.structured["status"], "authenticated");
    assert.equal(outcome.structured["assisted"], true);
  });

  it("captures orchestrator errors and returns structured failure without crashing", async () => {
    const mockOrchestrator = {
      execute: () => {
        return Promise.reject(new Error("Login timeout expired after 180s"));
      },
    };

    const outcome = await authTool(
      { app: "notebook", clean: true },
      { mode: "bidi" },
      { orchestrator: mockOrchestrator },
    );

    assert.equal(outcome.structured["status"], "unauthenticated");
    assert.equal(outcome.structured["assisted"], true);
    assert.ok((outcome.structured["error"] as string).includes("Login timeout expired"));
  });
});
