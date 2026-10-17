import assert from "node:assert/strict";
import { test } from "node:test";
import { DefaultProcessTerminator } from "../process-terminator.js";
import { PwaNavError } from "../../core/errors.js";

test("DefaultProcessTerminator: terminates gracefully when lock frees immediately", async () => {
  let killedPid: number | undefined;
  let forceUsed: boolean | undefined;

  const terminator = new DefaultProcessTerminator({
    killFn: (pid, force) => {
      killedPid = pid;
      forceUsed = force;
      return Promise.resolve();
    },
    lockDeps: {
      fs: {
        stat: () => Promise.reject(new Error("ENOENT")),
        readlink: () => Promise.resolve(""),
        unlink: () => Promise.resolve(),
        tryOpenExclusive: () => true,
      },
      inspector: {
        isAlive: () => false,
        findByArg: () => Promise.resolve([]),
      },
    },
    sleepFn: () => Promise.resolve(),
    nowFn: () => 1000,
  });

  await terminator.terminate(1234, "fake/profile");

  assert.equal(killedPid, 1234);
  assert.equal(forceUsed, false);
});

test("DefaultProcessTerminator: escalates to force kill if grace period expires before lock is freed", async () => {
  const killCalls: { pid: number; force: boolean }[] = [];
  let lockState: "held" | "free" = "held";
  let currentTime = 1000;

  const terminator = new DefaultProcessTerminator({
    killFn: (pid, force) => {
      killCalls.push({ pid, force });
      if (force) {
        lockState = "free";
      }
      return Promise.resolve();
    },
    lockDeps: {
      fs: {
        stat: () => (lockState === "free" ? Promise.reject(new Error("ENOENT")) : Promise.resolve({})),
        readlink: () => Promise.resolve(""),
        unlink: () => Promise.resolve(),
        tryOpenExclusive: () => lockState === "free",
      },
      inspector: {
        isAlive: () => lockState === "held",
        findByArg: () =>
          Promise.resolve(lockState === "held" ? [{ pid: 1234, command: "firefox.exe" }] : []),
      },
    },
    sleepFn: (ms) => {
      currentTime += ms;
      return Promise.resolve();
    },
    nowFn: () => currentTime,
  });

  await terminator.terminate(1234, "fake/profile", { gracePeriodMs: 1000, pollIntervalMs: 500 });

  assert.deepEqual(killCalls, [
    { pid: 1234, force: false },
    { pid: 1234, force: true },
  ]);
});

test("DefaultProcessTerminator: throws session_busy if lock remains held after force kill timeout", async () => {
  let currentTime = 1000;

  const terminator = new DefaultProcessTerminator({
    killFn: () => Promise.resolve(),
    lockDeps: {
      fs: {
        stat: () => Promise.resolve({}),
        readlink: () => Promise.resolve(""),
        unlink: () => Promise.resolve(),
        tryOpenExclusive: () => false,
      },
      inspector: {
        isAlive: () => true,
        findByArg: () => Promise.resolve([{ pid: 1234, command: "firefox.exe" }]),
      },
    },
    sleepFn: (ms) => {
      currentTime += ms;
      return Promise.resolve();
    },
    nowFn: () => currentTime,
  });

  await assert.rejects(
    () => terminator.terminate(1234, "fake/profile", { gracePeriodMs: 1000, pollIntervalMs: 500 }),
    (err: unknown) => err instanceof PwaNavError && err.code === "session_busy",
  );
});
