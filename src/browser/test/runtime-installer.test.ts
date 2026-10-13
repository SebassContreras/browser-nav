import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PwaNavError } from "../../core/errors.js";
import {
  findChecksum,
  parseLatestVersion,
  RELEASES_URL,
  UnsupportedPlatformInstaller,
  VERSIONS_URL,
  WindowsFirefoxInstaller,
  type HttpClient,
  type ProcessRunner,
} from "../runtime-installer.js";

const VERSION = "158.0";
const FILE = `win64/en-US/Firefox Setup ${VERSION}.exe`;
const PAYLOAD = "fake firefox setup";
const SHA = createHash("sha512").update(PAYLOAD).digest("hex");

function fakeHttp(options: { checksum?: string; requested?: string[] } = {}): HttpClient {
  const checksum = options.checksum ?? SHA;
  return {
    getText(url) {
      options.requested?.push(url);
      if (url === VERSIONS_URL) return Promise.resolve(JSON.stringify({ LATEST_FIREFOX_VERSION: VERSION }));
      if (url === `${RELEASES_URL}/${VERSION}/SHA512SUMS`) {
        return Promise.resolve(`${"0".repeat(128)}  win32/en-US/Firefox Setup ${VERSION}.exe\n${checksum}  ${FILE}\n`);
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    },
    async download(url, dest, onBytes) {
      options.requested?.push(url);
      await writeFile(dest, PAYLOAD);
      onBytes?.(PAYLOAD.length, PAYLOAD.length);
      return { sha512: createHash("sha512").update(PAYLOAD).digest("hex"), bytes: PAYLOAD.length };
    },
  };
}

// Simulates `setup.exe /ExtractDir=<dir>` producing <dir>/core/firefox.exe.
function fakeExtract(calls: string[][], exitCode = 0): ProcessRunner {
  return async (command, args) => {
    calls.push([command, ...args]);
    const dir = (args[0] ?? "").replace("/ExtractDir=", "");
    if (exitCode === 0) {
      await mkdir(join(dir, "core"), { recursive: true });
      await writeFile(join(dir, "core", "firefox.exe"), "exe");
    }
    return exitCode;
  };
}

async function withRuntimeDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-runtime-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("parseLatestVersion and findChecksum read Mozilla's published formats", () => {
  assert.equal(parseLatestVersion(JSON.stringify({ LATEST_FIREFOX_VERSION: "158.0.1" })), "158.0.1");
  assert.throws(() => parseLatestVersion("{}"), PwaNavError);
  assert.equal(findChecksum(`${SHA}  ${FILE}\n`, FILE), SHA);
  assert.equal(findChecksum(`${SHA}  other.exe\n`, FILE), undefined);
});

test("installs from Mozilla over HTTPS, verifies SHA-512, extracts only, and records the version", async () => {
  await withRuntimeDir(async (dir) => {
    const requested: string[] = [];
    const calls: string[][] = [];
    const progress: string[] = [];
    const installer = new WindowsFirefoxInstaller({
      env: { PWA_NAV_RUNTIME_DIR: dir },
      http: fakeHttp({ requested }),
      run: fakeExtract(calls),
    });
    assert.equal(await installer.installedVersion(), undefined);

    const result = await installer.install((p) => progress.push(p.phase));

    assert.equal(result.version, VERSION);
    assert.equal(result.binary, join(dir, "firefox", "firefox.exe"));
    assert.ok(existsSync(result.binary));
    assert.equal(await installer.installedVersion(), VERSION);
    for (const url of requested) assert.match(url, /^https:\/\/(product-details|archive)\.mozilla\.org\//);
    assert.ok(requested.includes(`${RELEASES_URL}/${VERSION}/win64/en-US/Firefox%20Setup%20${VERSION}.exe`));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.slice(1).map((a) => a.split("=")[0]), ["/ExtractDir"]);
    assert.deepEqual([...new Set(progress)], ["version", "download", "verify", "extract", "done"]);
    // Work files are cleaned up; only the runtime and version file remain.
    assert.deepEqual((await readdir(dir)).sort(), ["firefox", "version.json"]);
  });
});

test("checksum mismatch aborts before extraction and keeps the existing runtime", async () => {
  await withRuntimeDir(async (dir) => {
    await mkdir(join(dir, "firefox"), { recursive: true });
    await writeFile(join(dir, "firefox", "firefox.exe"), "old");
    const calls: string[][] = [];
    const installer = new WindowsFirefoxInstaller({
      env: { PWA_NAV_RUNTIME_DIR: dir },
      http: fakeHttp({ checksum: "a".repeat(128) }),
      run: fakeExtract(calls),
    });
    await assert.rejects(installer.install(), /SHA-512/);
    assert.equal(calls.length, 0);
    assert.equal(await readFile(join(dir, "firefox", "firefox.exe"), "utf8"), "old");
    assert.deepEqual(await readdir(dir), ["firefox"]);
  });
});

test("failed extraction leaves no half-installed runtime", async () => {
  await withRuntimeDir(async (dir) => {
    const installer = new WindowsFirefoxInstaller({
      env: { PWA_NAV_RUNTIME_DIR: dir },
      http: fakeHttp(),
      run: fakeExtract([], 2),
    });
    await assert.rejects(installer.install(), /extraction failed/);
    assert.deepEqual(await readdir(dir), []);
  });
});

test("unsupported platforms point to a manual install", async () => {
  const installer = new UnsupportedPlatformInstaller("linux");
  assert.equal(await installer.installedVersion(), undefined);
  await assert.rejects(installer.install(), (e: unknown) => e instanceof PwaNavError && e.code === "no_browser");
});
