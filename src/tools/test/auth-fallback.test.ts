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
        return Promise.resolve({
          command: 'Start-Process -FilePath "firefox.exe" -ArgumentList @("--profile", "fake/dir", "https://accounts.google.com")',
          shortcutPath: "C:\\Users\\fake\\.agent\\apps\\notebook\\notebook.lnk",
        });
      },
    };

    const outcome = await authTool(
      { app: "notebook", clean: true, port: 9555, timeoutMs: 120000 },
      { mode: "bidi" },
      {
        orchestrator: mockOrchestrator,
        platform: "win32",
        shortcutResolver: () => "C:\\Users\\fake\\.agent\\apps\\notebook\\notebook.lnk",
      },
    );

    assert.ok(orchestratorCalledWith !== undefined);
    assert.equal(orchestratorCalledWith.appSlug, "notebook");
    assert.equal(orchestratorCalledWith.port, 9555);
    assert.equal(orchestratorCalledWith.timeoutMs, 120000);
    assert.equal(outcome.structured["status"], "authenticated");
    assert.equal(outcome.structured["assisted"], true);
    assert.equal(outcome.structured["port"], 9555);
    const cmd = String(outcome.structured["command"]);
    assert.ok(cmd.startsWith("Start-Process"));
    assert.equal(outcome.structured["shortcutPath"], "C:\\Users\\fake\\.agent\\apps\\notebook\\notebook.lnk");
    const hint = String(outcome.structured["interactiveHint"]);
    assert.ok(hint.includes("isolated desktops"));
    assert.ok(outcome.text.includes("isolated desktops"));
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
      {
        orchestrator: mockOrchestrator,
        platform: "win32",
        shortcutResolver: () => null,
      },
    );

    assert.equal(outcome.structured["status"], "unauthenticated");
    assert.equal(outcome.structured["assisted"], true);
    const err = String(outcome.structured["error"]);
    assert.ok(err.includes("Login timeout expired"));
    const cmd = String(outcome.structured["command"]);
    assert.ok(cmd.includes("firefox"));
    assert.equal(outcome.structured["shortcutPath"], null);
    const hint = String(outcome.structured["interactiveHint"]);
    assert.ok(hint.includes("isolated desktops"));
    assert.ok(outcome.text.includes("isolated desktops"));
  });

  // Table-driven test suite across platform, shortcut availability, and execution partitions
  interface InteractiveCase {
    name: string;
    args: { app: string; clean?: boolean; action?: "status" | "clean" | "relay" };
    platform: string;
    shortcutPath: string | null;
    shouldFail?: boolean;
    expectedCommandPrefix: string;
    expectedShortcut: string | null;
    hintContains: string;
  }

  const testCases: InteractiveCase[] = [
    {
      name: "Windows partition with valid desktop shortcut and clean mode",
      args: { app: "notebook", clean: true },
      platform: "win32",
      shortcutPath: "C:\\Users\\user\\.agent\\apps\\notebook\\notebook.lnk",
      expectedCommandPrefix: "Start-Process",
      expectedShortcut: "C:\\Users\\user\\.agent\\apps\\notebook\\notebook.lnk",
      hintContains: "isolated desktops",
    },
    {
      name: "Windows partition with null shortcut (missing/failed shortcut creation)",
      args: { app: "notebook", action: "clean" },
      platform: "win32",
      shortcutPath: null,
      expectedCommandPrefix: "Start-Process",
      expectedShortcut: null,
      hintContains: "isolated desktops",
    },
    {
      name: "Non-Windows POSIX partition (Linux/macOS) with null shortcut fallback",
      args: { app: "https://example.com/dashboard", clean: true },
      platform: "linux",
      shortcutPath: "/home/user/.agent/apps/example-com/example-com.desktop",
      expectedCommandPrefix: "firefox",
      expectedShortcut: null,
      hintContains: "interactive desktop session",
    },
    {
      name: "Windows timeout failure retains interactive guidance and command fields",
      args: { app: "notebook", clean: true },
      platform: "win32",
      shortcutPath: "C:\\Users\\user\\.agent\\apps\\notebook\\notebook.lnk",
      shouldFail: true,
      expectedCommandPrefix: "Start-Process",
      expectedShortcut: "C:\\Users\\user\\.agent\\apps\\notebook\\notebook.lnk",
      hintContains: "isolated desktops",
    },
    {
      name: "Non-Windows failure outcome preserves command and null shortcut",
      args: { app: "dashboard", action: "clean" },
      platform: "darwin",
      shortcutPath: null,
      shouldFail: true,
      expectedCommandPrefix: "firefox",
      expectedShortcut: null,
      hintContains: "interactive desktop session",
    },
  ];

  for (const tc of testCases) {
    it(`table-driven interactive guidance: ${tc.name}`, async () => {
      const mockOrchestrator = {
        execute: () => {
          if (tc.shouldFail) {
            return Promise.reject(new Error("Timeout waiting for authentication"));
          }
          return Promise.resolve({
            command: `${tc.expectedCommandPrefix} --profile "path"`,
            shortcutPath: tc.expectedShortcut,
          });
        },
      };

      const outcome = await authTool(
        tc.args,
        { mode: "bidi" },
        {
          orchestrator: mockOrchestrator,
          platform: tc.platform,
          shortcutResolver: () => tc.shortcutPath,
        },
      );

      // Verify contract assertions
      assert.equal(outcome.structured["assisted"], true);
      assert.equal(
        outcome.structured["status"],
        tc.shouldFail ? "unauthenticated" : "authenticated",
      );
      const cmd = String(outcome.structured["command"]);
      assert.ok(
        cmd.includes(tc.expectedCommandPrefix),
        `Expected command to include '${tc.expectedCommandPrefix}', got '${String(outcome.structured["command"])}'`,
      );
      assert.equal(outcome.structured["shortcutPath"], tc.expectedShortcut);
      const hint = String(outcome.structured["interactiveHint"]);
      assert.ok(
        hint.includes(tc.hintContains),
        `Expected interactiveHint to include '${tc.hintContains}'`,
      );
      assert.ok(outcome.text.includes(tc.hintContains));
    });
  }
});
