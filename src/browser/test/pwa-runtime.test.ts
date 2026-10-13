import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { PwaNavError } from "../../core/errors.js";
import {
  FirefoxNotFoundError,
  firefoxCandidates,
  isLoginBarrier,
  launchCommandHint,
  locateFirefox,
  managedRuntimeBinary,
  managedRuntimeDir,
  resolveFirefoxBinary,
  validatePort,
  waitForPort,
} from "../pwa-runtime.js";

function expectCode(fn: () => unknown, expected: string, re?: RegExp): void {
  assert.throws(fn, (e: unknown) => {
    assert.ok(e instanceof PwaNavError);
    assert.equal(e.code, expected);
    if (re) assert.match(`${e.message} ${e.hint ?? ""}`, re);
    return true;
  });
}

test("firefoxCandidates lists stock Firefox install locations per platform", () => {
  const winEnv = { ProgramFiles: "/pf", "ProgramFiles(x86)": "/pf86", LOCALAPPDATA: "/local" };
  assert.deepEqual(firefoxCandidates("win32", winEnv), [
    join("/pf", "Mozilla Firefox", "firefox.exe"),
    join("/pf86", "Mozilla Firefox", "firefox.exe"),
    join("/local", "Mozilla Firefox", "firefox.exe"),
  ]);
  assert.deepEqual(firefoxCandidates("win32", {}), []);
  assert.equal(firefoxCandidates("linux", {})[0], "/usr/bin/firefox");
  assert.deepEqual(firefoxCandidates("darwin", { HOME: "/h" }), [
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    join("/h", "Applications", "Firefox.app", "Contents", "MacOS", "firefox"),
  ]);
  assert.deepEqual(firefoxCandidates("freebsd", {}), []);
});

test("resolveFirefoxBinary honors override, picks first existing candidate, and hints when missing", () => {
  assert.equal(resolveFirefoxBinary("win32", { PWA_NAV_FIREFOX_BINARY: "/x/firefox" }), "/x/firefox");
  assert.equal(resolveFirefoxBinary("freebsd", { PWA_NAV_FIREFOX_BINARY: "/x/firefox" }), "/x/firefox");
  const env = { ProgramFiles: "/pf", LOCALAPPDATA: "/local" };
  const user = join("/local", "Mozilla Firefox", "firefox.exe");
  assert.equal(resolveFirefoxBinary("win32", env, (p) => p === user), user);
  assert.equal(resolveFirefoxBinary("linux", {}, () => true), "/usr/bin/firefox");
  expectCode(() => resolveFirefoxBinary("win32", env, () => false), "no_browser", /pwa_install_runtime.*winget install Mozilla\.Firefox/);
  expectCode(() => resolveFirefoxBinary("darwin", {}, () => false), "no_browser", /PWA_NAV_FIREFOX_BINARY/);
  assert.throws(() => resolveFirefoxBinary("freebsd", {}), FirefoxNotFoundError);
});

test("managed runtime lives in pwa-nav's user data dir and is overridable", () => {
  assert.equal(managedRuntimeDir("win32", { LOCALAPPDATA: "/local" }), join("/local", "pwa-nav", "runtime"));
  assert.equal(managedRuntimeDir("linux", { HOME: "/h" }), join("/h", ".local", "share", "pwa-nav", "runtime"));
  assert.equal(managedRuntimeDir("linux", { XDG_DATA_HOME: "/xdg" }), join("/xdg", "pwa-nav", "runtime"));
  assert.equal(managedRuntimeDir("darwin", { HOME: "/h" }), join("/h", "Library", "Application Support", "pwa-nav", "runtime"));
  assert.equal(managedRuntimeDir("win32", { PWA_NAV_RUNTIME_DIR: "/rt" }), "/rt");
  assert.equal(managedRuntimeDir("win32", {}), undefined);
  assert.equal(managedRuntimeBinary("win32", { PWA_NAV_RUNTIME_DIR: "/rt" }), join("/rt", "firefox", "firefox.exe"));
});

test("locateFirefox order: override, installed, managed", () => {
  const env = { ProgramFiles: "/pf", PWA_NAV_RUNTIME_DIR: "/rt" };
  const installed = join("/pf", "Mozilla Firefox", "firefox.exe");
  const managed = join("/rt", "firefox", "firefox.exe");
  assert.deepEqual(locateFirefox("win32", { ...env, PWA_NAV_FIREFOX_BINARY: "/o" }, () => true), { binary: "/o", source: "override" });
  assert.deepEqual(locateFirefox("win32", env, () => true), { binary: installed, source: "installed" });
  assert.deepEqual(locateFirefox("win32", env, (p) => p === managed), { binary: managed, source: "managed" });
  assert.equal(locateFirefox("win32", env, () => false), undefined);
});

test("validatePort integer bounds checking", () => {
  assert.equal(validatePort(9222), 9222);
  assert.equal(validatePort(1024), 1024);
  assert.equal(validatePort(65535), 65535);
  for (const port of [1023, 65536, 1.5, Number.NaN]) {
    expectCode(() => validatePort(port), "invalid_args");
  }
});

test("launchCommandHint formats command per shell platform", () => {
  const args = ["--profile", "C:\\p q","--remote-debugging-port", "9222"];
  const ps = launchCommandHint("C:\\r\\firefox.exe", args, "win32");
  assert.match(ps, /^Start-Process -FilePath 'C:\\r\\firefox\.exe'/);
  assert.match(ps, /'--remote-debugging-port', '9222'/);
  const sh = launchCommandHint("/r/firefox", args, "linux");
  assert.match(sh, /'\/r\/firefox'/);
  assert.match(sh, /--remote-debugging-port.*9222.*&$/);
  const mac = launchCommandHint("/Applications/Firefox.app/Contents/MacOS/firefox", args, "darwin");
  assert.match(mac, /'\/Applications\/Firefox\.app\/Contents\/MacOS\/firefox'/);
  assert.match(mac, /--remote-debugging-port.*9222.*&$/);
});

test("waitForPort succeeds after retries", async () => {
  let calls = 0;
  await waitForPort("127.0.0.1", 9222, 1000, () => Promise.resolve(++calls >= 3), { intervalMs: 1 });
  assert.equal(calls, 3);
});

test("waitForPort times out with launch hint", async () => {
  await assert.rejects(
    waitForPort("127.0.0.1", 9222, 20, () => Promise.resolve(false), { intervalMs: 2, launchHint: "CMD --x" }),
    (e: unknown) => e instanceof PwaNavError && e.code === "timeout" && (e.hint ?? "").includes("CMD --x"),
  );
});

test("isLoginBarrier detects google accounts, auth routes and security strings", () => {
  assert.equal(isLoginBarrier("https://accounts.google.com/signin/v2/identifier"), true);
  assert.equal(isLoginBarrier("https://app.example.com/login"), true);
  assert.equal(isLoginBarrier("https://app.example.com/signin"), true);
  assert.equal(isLoginBarrier("https://notebook.google.com/u/0/"), false);
  assert.equal(isLoginBarrier("https://app.example.com/", "This browser or app may not be secure"), true);
  assert.equal(isLoginBarrier("https://app.example.com/", "Es posible que este navegador o aplicación no sea seguro"), true);
  assert.equal(isLoginBarrier("https://app.example.com/", "Welcome back to your dashboard"), false);
});
