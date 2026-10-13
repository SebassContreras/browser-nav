// pwa-runtime: Firefox binary discovery and socket probing.
// Spawns a stock Firefox install with WebDriver BiDi enabled.
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { PwaNavError } from "../core/errors.js";

export const BINARY_ENV = "PWA_NAV_FIREFOX_BINARY";
export const MIN_PORT = 1024;
export const MAX_PORT = 65535;
export const POLL_INTERVAL_MS = 200;
export const DEFAULT_LAUNCH_TIMEOUT_MS = 30_000;

export type Env = Readonly<Record<string, string | undefined>>;

const INSTALL_HINTS: Readonly<Record<string, string>> = {
  win32: "winget install Mozilla.Firefox",
  linux: "install the firefox package from your distribution",
  darwin: "brew install --cask firefox",
};

// Mozilla's default install locations per platform, in lookup order.
export function firefoxCandidates(platform: string, env: Env): string[] {
  const under = (base: string | undefined, ...parts: string[]): string[] =>
    base === undefined || base === "" ? [] : [join(base, ...parts)];
  switch (platform) {
    case "win32":
      return [
        ...under(env["ProgramFiles"], "Mozilla Firefox", "firefox.exe"),
        ...under(env["ProgramFiles(x86)"], "Mozilla Firefox", "firefox.exe"),
        ...under(env["LOCALAPPDATA"], "Mozilla Firefox", "firefox.exe"),
      ];
    case "linux":
      return ["/usr/bin/firefox", "/usr/lib/firefox/firefox", "/usr/lib64/firefox/firefox", "/snap/bin/firefox"];
    case "darwin":
      return [
        "/Applications/Firefox.app/Contents/MacOS/firefox",
        ...under(env["HOME"], "Applications", "Firefox.app", "Contents", "MacOS", "firefox"),
      ];
    default:
      return [];
  }
}

export function resolveFirefoxBinary(
  platform: string,
  env: Env,
  checkExists: (path: string) => boolean = existsSync,
): string {
  const override = env[BINARY_ENV];
  if (override !== undefined && override !== "") return override;
  const install = INSTALL_HINTS[platform];
  if (install === undefined) {
    throw new PwaNavError("invalid_args", `cannot locate Firefox on platform "${platform}"`, {
      hint: `set ${BINARY_ENV}, or launch Firefox manually with --profile <dir> --remote-debugging-port <port> <url>`,
    });
  }
  const found = firefoxCandidates(platform, env).find((path) => checkExists(path));
  if (found === undefined) {
    throw new PwaNavError("invalid_args", "Firefox is not installed in a default location", {
      hint: `${install}, or set ${BINARY_ENV} to the firefox executable`,
    });
  }
  return found;
}

export function validatePort(port: number): number {
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new PwaNavError(
      "invalid_args",
      `port must be an integer in ${String(MIN_PORT)}-${String(MAX_PORT)}, got ${String(port)}`,
    );
  }
  return port;
}

// Exact copy-paste command for `no_browser` hints.
export function launchCommandHint(binary: string, args: readonly string[], platform: string): string {
  if (platform === "win32") {
    const ps = (s: string): string => `'${s.replaceAll("'", "''")}'`;
    return `Start-Process -FilePath ${ps(binary)} -ArgumentList ${args.map(ps).join(", ")}`;
  }
  // POSIX shell (Linux, macOS bash/zsh): background execution with single-quoted arguments.
  const sh = (s: string): string => `'${s.replaceAll("'", "'\\''")}'`;
  return `${sh(binary)} ${args.map(sh).join(" ")} &`;
}

export type PortProbe = (host: string, port: number) => Promise<boolean>;

export const tcpProbe: PortProbe = (host, port) =>
  new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean): void => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000, () => {
      done(false);
    });
    socket.once("connect", () => {
      done(true);
    });
    socket.once("error", () => {
      done(false);
    });
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

// Waits for the port (never the PID); timeout error carries the launch command.
export async function waitForPort(
  host: string,
  port: number,
  timeoutMs: number,
  probe: PortProbe = tcpProbe,
  options: { intervalMs?: number; launchHint?: string } = {},
): Promise<void> {
  const interval = options.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await probe(host, port)) return;
    if (Date.now() >= deadline) break;
    await sleep(interval);
  }
  throw new PwaNavError("timeout", `port ${host}:${String(port)} did not open within ${String(timeoutMs)}ms`, {
    ...(options.launchHint === undefined ? {} : { hint: `launch manually: ${options.launchHint}` }),
  });
}

export function isLoginBarrier(url: string, pageText?: string): boolean {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (parsed.hostname.toLowerCase().includes("accounts.google.com")) return true;
    if (/\/(login|signin|sign-in|auth0|oauth)/i.test(parsed.pathname)) return true;
  } catch {
    // not a valid URL
  }
  if (pageText !== undefined) {
    if (
      pageText.includes("This browser or app may not be secure") ||
      pageText.includes("no sea seguro") ||
      pageText.includes("Sign in with Google") ||
      pageText.includes("Iniciar sesión con Google")
    ) {
      return true;
    }
  }
  return false;
}
