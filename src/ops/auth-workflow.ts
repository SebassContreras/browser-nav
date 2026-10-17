import { type AuthWatcher, DefaultAuthWatcher } from "../browser/auth-watcher.js";
import { type ProcessTerminator, DefaultProcessTerminator } from "../browser/process-terminator.js";
import {
  launchStandaloneApp,
  launchStandaloneAppClean,
  type StandaloneLaunchResult,
  type CleanStandaloneLaunchResult,
} from "../browser/standalone-runner.js";

export interface AssistedAuthOptions {
  url: string;
  appSlug: string;
  port?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
  cacheDir?: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export interface AssistedAuthResult {
  appSlug: string;
  url: string;
  port: number;
  cleanResult: CleanStandaloneLaunchResult;
  debugResult: StandaloneLaunchResult;
}

export interface AuthWorkflowDeps {
  launchCleanFn?: typeof launchStandaloneAppClean;
  launchDebugFn?: typeof launchStandaloneApp;
  watcher?: AuthWatcher;
  terminator?: ProcessTerminator;
}

/**
 * Orchestrator service coordinating assisted authentication workflow.
 * Follows SRP: only responsible for transitioning an app through clean -> auth -> debug stages.
 * Follows DRY & Composition: composes injected launch functions, AuthWatcher, and ProcessTerminator.
 */
export class AuthWorkflowOrchestrator {
  private readonly launchClean: typeof launchStandaloneAppClean;
  private readonly launchDebug: typeof launchStandaloneApp;
  private readonly watcher: AuthWatcher;
  private readonly terminator: ProcessTerminator;

  constructor(deps: AuthWorkflowDeps = {}) {
    this.launchClean = deps.launchCleanFn ?? launchStandaloneAppClean;
    this.launchDebug = deps.launchDebugFn ?? launchStandaloneApp;
    this.watcher = deps.watcher ?? new DefaultAuthWatcher();
    this.terminator = deps.terminator ?? new DefaultProcessTerminator();
  }

  async execute(options: AssistedAuthOptions): Promise<AssistedAuthResult> {
    const port = options.port ?? 9222;
    const url = options.url;
    const appSlug = options.appSlug;
    const report = options.onProgress ?? (() => undefined);

    report(`Launching '${appSlug}' in clean mode (no debugging port). Please sign in manually...`);
    const cleanResult = await this.launchClean({
      url,
      appSlug,
      cacheDir: options.cacheDir,
    });

    const targetHost = new URL(url).hostname;
    const pid = cleanResult.pid;

    try {
      report(`Monitoring authentication for ${targetHost}...`);
      await this.watcher.waitForAuth({
        profileDir: cleanResult.profileDir,
        host: targetHost,
        timeoutMs: options.timeoutMs,
        pollIntervalMs: options.pollIntervalMs,
        signal: options.signal,
      });

      report("Authentication confirmed! Transitioning to debug mode...");
    } catch (err) {
      if (pid !== undefined) {
        // Attempt clean shutdown on abort/timeout
        try {
          await this.terminator.terminate(pid, cleanResult.profileDir);
        } catch {
          // Ignore secondary cleanup error
        }
      }
      throw err;
    }

    if (pid !== undefined) {
      await this.terminator.terminate(pid, cleanResult.profileDir, {
        signal: options.signal,
      });
    }

    report(`Restarting '${appSlug}' in debug mode on port ${String(port)}...`);
    const debugResult = await this.launchDebug({
      url,
      appSlug,
      port,
      cacheDir: options.cacheDir,
    });

    return {
      appSlug,
      url,
      port,
      cleanResult,
      debugResult,
    };
  }
}
