import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthWorkflowOrchestrator } from "../auth-workflow.js";
import { PwaNavError } from "../../core/errors.js";

test("AuthWorkflowOrchestrator: completes full clean -> observe -> terminate -> debug cycle", async () => {
  const steps: string[] = [];

  const orchestrator = new AuthWorkflowOrchestrator({
    launchCleanFn: () => {
      steps.push("launchClean");
      return Promise.resolve({
        appSlug: "notebook",
        url: "https://notebook.google.com",
        profileDir: "fake/profile",
        command: "firefox",
        pid: 9999,
      });
    },
    watcher: {
      waitForAuth: () => {
        steps.push("waitForAuth");
        return Promise.resolve({ verdict: "authenticated" });
      },
    },
    terminator: {
      terminate: (pid) => {
        steps.push(`terminate:${String(pid)}`);
        return Promise.resolve();
      },
    },
    launchDebugFn: () => {
      steps.push("launchDebug");
      return Promise.resolve({
        appSlug: "notebook",
        url: "https://notebook.google.com",
        profileDir: "fake/profile",
        port: 9222,
        command: "firefox --remote-debugging-port 9222",
        pid: 10000,
      });
    },
  });

  const progress: string[] = [];
  const res = await orchestrator.execute({
    url: "https://notebook.google.com",
    appSlug: "notebook",
    port: 9222,
    onProgress: (msg) => progress.push(msg),
  });

  assert.equal(res.appSlug, "notebook");
  assert.equal(res.port, 9222);
  assert.deepEqual(steps, ["launchClean", "waitForAuth", "terminate:9999", "launchDebug"]);
  assert.equal(progress.length, 4);
});

test("AuthWorkflowOrchestrator: cleans up process on watcher timeout", async () => {
  const steps: string[] = [];

  const orchestrator = new AuthWorkflowOrchestrator({
    launchCleanFn: () => {
      steps.push("launchClean");
      return Promise.resolve({
        appSlug: "notebook",
        url: "https://notebook.google.com",
        profileDir: "fake/profile",
        command: "firefox",
        pid: 9999,
      });
    },
    watcher: {
      waitForAuth: () => {
        steps.push("waitForAuth");
        return Promise.reject(new PwaNavError("timeout", "timeout expired"));
      },
    },
    terminator: {
      terminate: (pid) => {
        steps.push(`terminate:${String(pid)}`);
        return Promise.resolve();
      },
    },
    launchDebugFn: () => {
      steps.push("launchDebug");
      return Promise.resolve({
        appSlug: "notebook",
        url: "https://notebook.google.com",
        profileDir: "fake/profile",
        port: 9222,
        command: "firefox",
        pid: 10000,
      });
    },
  });

  await assert.rejects(
    () =>
      orchestrator.execute({
        url: "https://notebook.google.com",
        appSlug: "notebook",
      }),
    (err: unknown) => err instanceof PwaNavError && err.code === "timeout",
  );

  assert.deepEqual(steps, ["launchClean", "waitForAuth", "terminate:9999"]);
});
