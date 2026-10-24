import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authTool } from "../auth.js";
import { performAuthRelay } from "../../ops/ops.js";

describe("authTool and automated auth sync", () => {
  it("rejects execution when backend mode is offline", async () => {
    // Arrange & Act & Assert
    await assert.rejects(
      async () => {
        await authTool({}, { mode: "offline" });
      },
      (err: unknown) => {
        const error = err as { code?: string };
        assert.equal(error.code, "invalid_args");
        return true;
      },
    );
  });

  it("performs automated cookie check and returns structured outcome without prompts", async () => {
    // Arrange & Act
    const outcome = await authTool({ app: "linkedin" }, { mode: "bidi" });

    // Assert
    assert.ok(outcome.text !== undefined && outcome.text.length > 0);
    const structured = outcome.structured;
    assert.equal(structured["siteId"], "linkedin");
    assert.ok(typeof structured["status"] === "string" && structured["status"].length > 0);
  });

  it("performAuthRelay returns structured verdict for target application", async () => {
    // Act
    const result = await performAuthRelay({ appOrUrl: "https://notebook.google.com" });

    // Assert
    assert.ok(result.status.length > 0);
    assert.ok(result.message.includes("notebook"));
    assert.equal(typeof result.syncedCookies, "number");
  });
});
