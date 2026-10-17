import { spawn, type ChildProcess } from "node:child_process";
import { PwaNavError } from "../core/errors.js";
import {
  DEFAULT_LAUNCH_TIMEOUT_MS,
  launchCommandHint,
  resolveFirefoxBinary,
  tcpProbe,
  validatePort,
  waitForPort,
  type PortProbe,
} from "./pwa-runtime.js";
import { ensureStandaloneProfile } from "./standalone-profile.js";

import type { PwaInstanceRegistry } from "./port-allocator.js";
import { allocatePort } from "./port-allocator.js";
import { FileInstanceRegistry } from "./instance-registry.js";
import {
  inspectProfileLock,
  clearStaleLock,
  type ProfileLockDeps,
} from "./profile-lock.js";

export interface StandaloneLaunchOptions {
  url: string;
  appSlug: string;
  port?: number;
  headless?: boolean;
  host?: string;
  timeoutMs?: number;
  platform?: string;
  env?: NodeJS.ProcessEnv;
  cacheDir?: string;
  probe?: PortProbe;
  registry?: PwaInstanceRegistry;
  intervalMs?: number;
  spawnFn?: (binary: string, args: string[]) => ChildProcess;
  lockDeps?: ProfileLockDeps;
}

export interface StandaloneLaunchResult {
  appSlug: string;
  url: string;
  port: number;
  profileDir: string;
  command: string;
  pid: number | undefined;
}

export function buildStandaloneLaunchArgs(options: {
  profileDir: string;
  port: number;
  url: string;
  headless?: boolean;
}): string[] {
  validatePort(options.port);
  const args = [
    "-no-remote",
    "--profile",
    options.profileDir,
    "--remote-debugging-port",
    String(options.port),
  ];
  if (options.headless === true) {
    args.push("--headless");
  }
  args.push(options.url);
  return args;
}

export function buildCleanStandaloneLaunchArgs(options: {
  profileDir: string;
  url: string;
  headless?: boolean;
}): string[] {
  const args = [
    "-no-remote",
    "--profile",
    options.profileDir,
  ];
  if (options.headless === true) {
    args.push("--headless");
  }
  args.push(options.url);
  return args;
}

export interface CleanStandaloneLaunchOptions {
  url: string;
  appSlug: string;
  headless?: boolean;
  platform?: string;
  env?: NodeJS.ProcessEnv;
  cacheDir?: string;
  spawnFn?: (binary: string, args: string[]) => ChildProcess;
  lockDeps?: ProfileLockDeps;
}

export interface CleanStandaloneLaunchResult {
  appSlug: string;
  url: string;
  profileDir: string;
  command: string;
  pid: number | undefined;
}

async function handleProfileLockPreSpawn(
  profileDir: string,
  appSlug: string,
  platform: NodeJS.Platform,
  lockDeps?: ProfileLockDeps,
): Promise<void> {
  const deps: ProfileLockDeps = {
    platform,
    ...lockDeps,
  };
  const lock = await inspectProfileLock(profileDir, deps);
  if (lock.state === "held") {
    const holder = lock.holders[0];
    const pidStr = holder?.pid !== undefined ? String(holder.pid) : undefined;
    const killCmd =
      platform === "win32"
        ? (pidStr ? `taskkill /PID ${pidStr}` : "taskkill /IM firefox.exe")
        : (pidStr ? `kill ${pidStr}` : "killall firefox");
    const msg = holder && pidStr
      ? `profile ${appSlug} is in use by ${holder.command} (PID ${pidStr}). Close the window or run '${killCmd}'`
      : `profile ${appSlug} is currently in use. Close the window or run '${killCmd}'`;
    throw new PwaNavError("session_busy", msg);
  }
  if (lock.state === "stale") {
    await clearStaleLock(profileDir, deps);
  }
}

export async function launchStandaloneAppClean(
  options: CleanStandaloneLaunchOptions,
): Promise<CleanStandaloneLaunchResult> {
  const platform = (options.platform ?? process.platform) as NodeJS.Platform;
  const env = options.env ?? process.env;
  const url = options.url;
  const appSlug = options.appSlug;

  const binary = resolveFirefoxBinary(platform, env);
  const profileDir = await ensureStandaloneProfile(appSlug, { cacheDir: options.cacheDir });

  await handleProfileLockPreSpawn(profileDir, appSlug, platform, options.lockDeps);

  const args = buildCleanStandaloneLaunchArgs({
    profileDir,
    url,
    ...(options.headless === undefined ? {} : { headless: options.headless }),
  });
  const command = launchCommandHint(binary, args, platform);

  const child = (options.spawnFn ?? defaultSpawn)(binary, args);
  child.on("error", () => undefined);
  child.unref();

  return {
    appSlug,
    url,
    profileDir,
    command,
    pid: child.pid,
  };
}

function defaultSpawn(binary: string, args: string[]): ChildProcess {
  return spawn(binary, args, { detached: true, stdio: "ignore" });
}

export async function launchStandaloneApp(options: StandaloneLaunchOptions): Promise<StandaloneLaunchResult> {
  const platform = (options.platform ?? process.platform) as NodeJS.Platform;
  const env = options.env ?? process.env;
  const host = options.host ?? "127.0.0.1";
  const probe = options.probe ?? tcpProbe;
  const url = options.url;
  const appSlug = options.appSlug;

  const registry = options.registry ?? new FileInstanceRegistry({ cacheDir: options.cacheDir, probe, host });
  const activeInstances = await registry.prune();
  const reservedPorts = activeInstances.map((i) => i.port);

  let port = options.port;
  if (port === undefined) {
    port = await allocatePort(reservedPorts, { host, probe });
  } else {
    validatePort(port);
  }

  const binary = resolveFirefoxBinary(platform, env);
  const profileDir = await ensureStandaloneProfile(appSlug, { cacheDir: options.cacheDir });

  await handleProfileLockPreSpawn(profileDir, appSlug, platform, options.lockDeps);

  const args = buildStandaloneLaunchArgs({
    profileDir,
    port,
    url,
    ...(options.headless === undefined ? {} : { headless: options.headless }),
  });
  const command = launchCommandHint(binary, args, platform);

  if (await probe(host, port)) {
    throw new PwaNavError(
      "invalid_args",
      `port ${String(port)} is already listening: already running, attach instead`,
    );
  }

  const child = (options.spawnFn ?? defaultSpawn)(binary, args);
  child.on("error", () => undefined);
  child.unref();

  await waitForPort(host, port, options.timeoutMs ?? DEFAULT_LAUNCH_TIMEOUT_MS, probe, {
    launchHint: command,
    ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
  });

  const result: StandaloneLaunchResult = {
    appSlug,
    url,
    port,
    profileDir,
    command,
    pid: child.pid,
  };

  await registry.register({
    appSlug,
    url,
    port,
    pid: child.pid,
    profileDir,
    startedAt: new Date().toISOString(),
  });

  return result;
}
