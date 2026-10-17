import { PwaNavError } from "../core/errors.js";
import { evaluateSessionHealth, type SessionVerdict } from "./session-health.js";
import { readProfileCookies, type StoredCookie } from "./session-reader.js";

export interface WatchAuthOptions {
  profileDir: string;
  host: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  authCookieNames?: readonly string[];
  signal?: AbortSignal;
}

/**
 * Service boundary interface for monitoring session health until authenticated.
 * Follows SRP: only responsible for observing profile authentication status.
 * Anti-corruption: swappable and testable without touching real files or timers.
 */
export interface AuthWatcher {
  waitForAuth(options: WatchAuthOptions): Promise<{ verdict: SessionVerdict }>;
}

export interface AuthWatcherDeps {
  readCookiesFn?: (profileDir: string) => Promise<StoredCookie[] | null>;
  evaluateHealthFn?: typeof evaluateSessionHealth;
  sleepFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
  nowFn?: () => number;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PwaNavError("timeout", "auth observation aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new PwaNavError("timeout", "auth observation aborted"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class DefaultAuthWatcher implements AuthWatcher {
  private readonly readCookies: (profileDir: string) => Promise<StoredCookie[] | null>;
  private readonly evaluateHealth: typeof evaluateSessionHealth;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly now: () => number;

  constructor(deps: AuthWatcherDeps = {}) {
    this.readCookies = deps.readCookiesFn ?? readProfileCookies;
    this.evaluateHealth = deps.evaluateHealthFn ?? evaluateSessionHealth;
    this.sleep = deps.sleepFn ?? defaultSleep;
    this.now = deps.nowFn ?? Date.now;
  }

  async waitForAuth(options: WatchAuthOptions): Promise<{ verdict: SessionVerdict }> {
    const timeoutMs = options.timeoutMs ?? 180_000;
    const pollIntervalMs = options.pollIntervalMs ?? 1_000;
    const startTime = this.now();

    for (;;) {
      if (options.signal !== undefined && options.signal.aborted) {
        throw new PwaNavError("timeout", "auth observation aborted by caller");
      }

      const elapsed = this.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new PwaNavError(
          "timeout",
          `timed out waiting for session authentication on ${options.host} after ${String(Math.round(timeoutMs / 1000))}s`,
        );
      }

      try {
        const cookies = await this.readCookies(options.profileDir);
        const health = this.evaluateHealth(cookies, {
          host: options.host,
          nowMs: this.now(),
          ...(options.authCookieNames ? { authCookieNames: options.authCookieNames } : {}),
        });

        if (health.verdict === "authenticated") {
          return { verdict: health.verdict };
        }
      } catch (err) {
        // Tolerant to transient SQLite lock/copy collisions during user sign in
        if (err instanceof PwaNavError && err.code === "timeout") {
          throw err;
        }
      }

      const remaining = timeoutMs - (this.now() - startTime);
      const nextSleep = Math.min(pollIntervalMs, Math.max(0, remaining));
      if (nextSleep <= 0) {
        throw new PwaNavError(
          "timeout",
          `timed out waiting for session authentication on ${options.host} after ${String(Math.round(timeoutMs / 1000))}s`,
        );
      }

      await this.sleep(nextSleep, options.signal);
    }
  }
}
