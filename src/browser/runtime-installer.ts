// runtime-installer: downloads the official Mozilla Firefox into browser-nav's own runtime dir (spec 015).
// Extract-only (Windows full installer /ExtractDir): no registry, shortcuts, default browser or admin rights.
// Vendors (HTTP, child processes) sit behind small injected interfaces so the flow is testable offline.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { PwaNavError } from "../core/errors.js";
import { type Env, managedRuntimeBinary, managedRuntimeDir } from "./pwa-runtime.js";

export const VERSIONS_URL = "https://product-details.mozilla.org/1.0/firefox_versions.json";
export const RELEASES_URL = "https://archive.mozilla.org/pub/firefox/releases";
export const BUILD_LOCALE = "en-US";
const VERSION_FILE = "version.json";

export interface InstallProgress {
  phase: "version" | "download" | "verify" | "extract" | "done";
  receivedBytes?: number;
  totalBytes?: number;
}

export interface InstallResult {
  version: string;
  binary: string;
  bytes: number;
}

export interface RuntimeInstaller {
  install(onProgress?: (progress: InstallProgress) => void): Promise<InstallResult>;
  installedVersion(): Promise<string | undefined>;
}

/** Minimal HTTP surface the installer needs (wraps global fetch). */
export interface HttpClient {
  getText(url: string): Promise<string>;
  /** Streams url into dest; returns hex SHA-512 and byte count. */
  download(url: string, dest: string, onBytes?: (received: number, total?: number) => void): Promise<{ sha512: string; bytes: number }>;
}

/** Runs a program to completion and resolves with its exit code. */
export type ProcessRunner = (command: string, args: readonly string[]) => Promise<number>;

function networkError(url: string, cause: unknown): PwaNavError {
  return new PwaNavError("no_browser", `download failed: ${url}`, {
    hint: "check the internet connection or proxy, or install Firefox manually",
    cause,
  });
}

export const fetchHttpClient: HttpClient = {
  async getText(url) {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw networkError(url, error);
    }
    if (!response.ok) throw networkError(url, new Error(`HTTP ${String(response.status)}`));
    return response.text();
  },
  async download(url, dest, onBytes) {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw networkError(url, error);
    }
    if (!response.ok || response.body === null) throw networkError(url, new Error(`HTTP ${String(response.status)}`));
    const header = response.headers.get("content-length");
    const total = header === null ? undefined : Number(header);
    const hash = createHash("sha512");
    let received = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        hash.update(chunk);
        received += chunk.length;
        onBytes?.(received, total);
        done(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body as WebReadableStream), meter, createWriteStream(dest));
    return { sha512: hash.digest("hex"), bytes: received };
  },
};

export const spawnRunner: ProcessRunner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: "ignore", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code ?? 1);
    });
  });

/** Parses `LATEST_FIREFOX_VERSION` from Mozilla product-details JSON. */
export function parseLatestVersion(json: string): string {
  const version = (JSON.parse(json) as Record<string, unknown>)["LATEST_FIREFOX_VERSION"];
  if (typeof version !== "string" || !/^\d+(\.\d+)+$/.test(version)) {
    throw new PwaNavError("protocol", "unexpected Firefox version data from Mozilla");
  }
  return version;
}

/** Finds the SHA-512 for `file` in a Mozilla SHA512SUMS listing (`<hash>  <path>`). */
export function findChecksum(sums: string, file: string): string | undefined {
  for (const line of sums.split("\n")) {
    const match = /^([0-9a-f]{128})\s+(.+)$/.exec(line.trim());
    if (match?.[2] === file) return match[1];
  }
  return undefined;
}

export interface WindowsInstallerOptions {
  env: Env;
  http?: HttpClient;
  run?: ProcessRunner;
}

export class WindowsFirefoxInstaller implements RuntimeInstaller {
  private readonly runtimeDir: string;
  private readonly binary: string;
  private readonly http: HttpClient;
  private readonly run: ProcessRunner;

  constructor(options: WindowsInstallerOptions) {
    const dir = managedRuntimeDir("win32", options.env);
    const binary = managedRuntimeBinary("win32", options.env);
    if (dir === undefined || binary === undefined) {
      throw new PwaNavError("invalid_args", "cannot locate the user data dir (LOCALAPPDATA is not set)");
    }
    this.runtimeDir = dir;
    this.binary = binary;
    this.http = options.http ?? fetchHttpClient;
    this.run = options.run ?? spawnRunner;
  }

  async installedVersion(): Promise<string | undefined> {
    if (!existsSync(this.binary)) return undefined;
    try {
      const data = JSON.parse(await readFile(join(this.runtimeDir, VERSION_FILE), "utf8")) as { version?: unknown };
      return typeof data.version === "string" ? data.version : undefined;
    } catch {
      return undefined;
    }
  }

  async install(onProgress?: (progress: InstallProgress) => void): Promise<InstallResult> {
    onProgress?.({ phase: "version" });
    const version = parseLatestVersion(await this.http.getText(VERSIONS_URL));
    const file = `win64/${BUILD_LOCALE}/Firefox Setup ${version}.exe`;
    const releaseUrl = `${RELEASES_URL}/${version}`;
    const expected = findChecksum(await this.http.getText(`${releaseUrl}/SHA512SUMS`), file);
    if (expected === undefined) {
      throw new PwaNavError("protocol", `no checksum published for Firefox ${version}`);
    }

    const work = join(this.runtimeDir, `.install-${String(process.pid)}`);
    const setup = join(work, "firefox-setup.exe");
    const staging = join(work, "extract");
    const target = dirname(this.binary);
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });
    try {
      onProgress?.({ phase: "download" });
      const downloaded = await this.http.download(`${releaseUrl}/${encodeURI(file)}`, setup, (receivedBytes, totalBytes) => {
        onProgress?.({ phase: "download", receivedBytes, ...(totalBytes === undefined ? {} : { totalBytes }) });
      });

      onProgress?.({ phase: "verify" });
      if (downloaded.sha512 !== expected) {
        throw new PwaNavError("protocol", "downloaded Firefox does not match Mozilla's SHA-512 checksum", {
          hint: "retry the install; if it keeps failing, install Firefox manually",
        });
      }

      onProgress?.({ phase: "extract" });
      const code = await this.run(setup, [`/ExtractDir=${staging}`]);
      const extracted = [join(staging, "core"), staging].find((dir) => existsSync(join(dir, "firefox.exe")));
      if (code !== 0 || extracted === undefined) {
        throw new PwaNavError("protocol", `Firefox extraction failed (exit ${String(code)})`);
      }

      // Swap in atomically: the old runtime is removed only once the new one is fully extracted.
      await rm(target, { recursive: true, force: true });
      await rename(extracted, target);
      await writeFile(join(this.runtimeDir, VERSION_FILE), `${JSON.stringify({ version, locale: BUILD_LOCALE })}\n`);
      onProgress?.({ phase: "done" });
      return { version, binary: this.binary, bytes: (await stat(setup)).size };
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
}

export class UnsupportedPlatformInstaller implements RuntimeInstaller {
  constructor(private readonly platform: string) {}

  installedVersion(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  install(): Promise<InstallResult> {
    return Promise.reject(
      new PwaNavError("no_browser", `automatic Firefox install is not available on "${this.platform}" yet`, {
        hint: "install Firefox with your package manager (macOS: brew install --cask firefox), or set PWA_NAV_FIREFOX_BINARY",
      }),
    );
  }
}

export function createRuntimeInstaller(platform: string, env: Env): RuntimeInstaller {
  return platform === "win32" ? new WindowsFirefoxInstaller({ env }) : new UnsupportedPlatformInstaller(platform);
}
