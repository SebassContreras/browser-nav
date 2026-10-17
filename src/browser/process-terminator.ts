import { PwaNavError } from "../core/errors.js";
import { inspectProfileLock, type ProfileLockDeps } from "./profile-lock.js";

export interface TerminateOptions {
  gracePeriodMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}

/**
 * Service boundary interface for gracefully terminating browser processes and verifying lock release.
 * Follows SRP: only responsible for stopping the process and ensuring the profile directory lock is freed.
 * Anti-corruption: isolates OS-specific kill commands and inspectProfileLock loops behind an interface.
 */
export interface ProcessTerminator {
  terminate(pid: number, profileDir: string, options?: TerminateOptions): Promise<void>;
}

export interface ProcessTerminatorDeps {
  platform?: NodeJS.Platform;
  killFn?: (pid: number, force: boolean) => Promise<void>;
  sleepFn?: (ms: number) => Promise<void>;
  lockDeps?: ProfileLockDeps;
  nowFn?: () => number;
}

async function defaultKill(pid: number, force: boolean, platform: NodeJS.Platform): Promise<void> {
  if (platform === "win32") {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const args = ["/PID", String(pid), "/T"];
    if (force) {
      args.push("/F");
    }
    try {
      await execFileAsync("taskkill", args);
    } catch {
      // Process may already have terminated cleanly
    }
  } else {
    try {
      process.kill(pid, force ? "SIGKILL" : "SIGTERM");
    } catch {
      // Ignore if ESRCH (already dead)
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DefaultProcessTerminator implements ProcessTerminator {
  private readonly platform: NodeJS.Platform;
  private readonly kill: (pid: number, force: boolean) => Promise<void>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly lockDeps?: ProfileLockDeps;
  private readonly now: () => number;

  constructor(deps: ProcessTerminatorDeps = {}) {
    this.platform = deps.platform ?? process.platform;
    this.kill = deps.killFn ?? ((pid, force) => defaultKill(pid, force, this.platform));
    this.sleep = deps.sleepFn ?? defaultSleep;
    this.lockDeps = deps.lockDeps;
    this.now = deps.nowFn ?? Date.now;
  }

  async terminate(pid: number, profileDir: string, options: TerminateOptions = {}): Promise<void> {
    const gracePeriodMs = options.gracePeriodMs ?? 4_000;
    const pollIntervalMs = options.pollIntervalMs ?? 250;
    const startTime = this.now();

    // 1. Request graceful termination first
    await this.kill(pid, false);

    // 2. Poll until profile lock is verified 'free'
    let forceKillAttempted = false;
    for (;;) {
      if (options.signal !== undefined && options.signal.aborted) {
        throw new PwaNavError("timeout", "termination aborted by signal");
      }

      const lock = await inspectProfileLock(profileDir, {
        platform: this.platform,
        ...this.lockDeps,
      });

      if (lock.state === "free") {
        return;
      }
      if (lock.state === "stale") {
        const { clearStaleLock } = await import("./profile-lock.js");
        await clearStaleLock(profileDir, {
          platform: this.platform,
          ...this.lockDeps,
        });
        return;
      }

      const elapsed = this.now() - startTime;
      if (elapsed >= gracePeriodMs && !forceKillAttempted) {
        // Escalate to force kill if grace period exceeded
        await this.kill(pid, true);
        if (lock.holders.length > 0) {
          for (const holder of lock.holders) {
            if (holder.pid !== pid) {
              await this.kill(holder.pid, true);
            }
          }
        }
        forceKillAttempted = true;
      } else if (elapsed >= gracePeriodMs + 4_000) {
        throw new PwaNavError(
          "session_busy",
          `failed to release profile lock for PID ${String(pid)} after termination timeout`,
        );
      }

      await this.sleep(pollIntervalMs);
    }
  }
}
