import assert from "node:assert/strict";
import { test } from "node:test";
import { DefaultAuthWatcher } from "../auth-watcher.js";
import { PwaNavError } from "../../core/errors.js";
import type { StoredCookie } from "../session-reader.js";

test("DefaultAuthWatcher: resolves immediately when cookies are already authenticated", async () => {
  const fakeCookies: StoredCookie[] = [
    {
      name: "SID",
      host: "notebook.google.com",
      path: "/",
      expiry: Math.floor(Date.now() / 1000) + 3600,
    },
  ];

  const watcher = new DefaultAuthWatcher({
    readCookiesFn: () => Promise.resolve(fakeCookies),
    sleepFn: () => Promise.resolve(),
    nowFn: () => 1000,
  });

  const res = await watcher.waitForAuth({
    profileDir: "fake/profile",
    host: "notebook.google.com",
    timeoutMs: 5000,
  });

  assert.equal(res.verdict, "authenticated");
});

test("DefaultAuthWatcher: polls until cookies change to authenticated", async () => {
  let callCount = 0;
  const fakeCookies: StoredCookie[] = [
    {
      name: "SID",
      host: "notebook.google.com",
      path: "/",
      expiry: 2000,
    },
  ];

  const watcher = new DefaultAuthWatcher({
    readCookiesFn: () => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve(null);
      }
      return Promise.resolve(fakeCookies);
    },
    sleepFn: () => Promise.resolve(),
    nowFn: () => 1000,
  });

  const res = await watcher.waitForAuth({
    profileDir: "fake/profile",
    host: "notebook.google.com",
    timeoutMs: 5000,
  });

  assert.equal(callCount, 3);
  assert.equal(res.verdict, "authenticated");
});

test("DefaultAuthWatcher: throws timeout error when timeoutMs is reached", async () => {
  let currentTime = 1000;
  const watcher = new DefaultAuthWatcher({
    readCookiesFn: () => Promise.resolve(null),
    sleepFn: (ms) => {
      currentTime += ms;
      return Promise.resolve();
    },
    nowFn: () => currentTime,
  });

  await assert.rejects(
    () =>
      watcher.waitForAuth({
        profileDir: "fake/profile",
        host: "notebook.google.com",
        timeoutMs: 3000,
        pollIntervalMs: 1000,
      }),
    (err: unknown) => err instanceof PwaNavError && err.code === "timeout",
  );
});

test("DefaultAuthWatcher: aborts when AbortSignal is triggered", async () => {
  const controller = new AbortController();
  const watcher = new DefaultAuthWatcher({
    readCookiesFn: () => Promise.resolve(null),
    sleepFn: () => {
      controller.abort();
      return Promise.resolve();
    },
    nowFn: () => 1000,
  });

  await assert.rejects(
    () =>
      watcher.waitForAuth({
        profileDir: "fake/profile",
        host: "notebook.google.com",
        signal: controller.signal,
      }),
    /aborted/,
  );
});
