import { dirname, join } from "node:path";
import { PwaNavError } from "../core/errors.js";
import { performAuthRelay } from "../ops/ops.js";
import { resolveAppTarget } from "../backend/backend.js";
import {
  AuthWorkflowOrchestrator,
  type AssistedAuthOptions,
  type AssistedAuthResult,
} from "../ops/auth-workflow.js";
import { launchCommandHint, resolveFirefoxBinary } from "../browser/pwa-runtime.js";
import { buildCleanStandaloneLaunchArgs } from "../browser/standalone-runner.js";
import { resolveStandaloneProfileDir } from "../browser/standalone-profile.js";
import { type ToolOutcome } from "./types.js";

export interface AuthArgs {
  app?: string;
  clean?: boolean;
  action?: "status" | "clean" | "relay";
  timeoutMs?: number;
  port?: number;
  cacheDir?: string;
}

export interface AuthToolDeps {
  orchestrator?: {
    execute(options: AssistedAuthOptions): Promise<unknown>;
  };
  platform?: string;
  env?: NodeJS.ProcessEnv;
  shortcutResolver?: (appSlug: string, profileDir: string) => string | null;
}

function computeInteractiveDetails(options: {
  appSlug: string;
  url: string;
  cacheDir?: string;
  platform: string;
  env: NodeJS.ProcessEnv;
  shortcutResolver?: (appSlug: string, profileDir: string) => string | null;
  executedCommand?: string;
  executedShortcutPath?: string | null;
}): {
  command: string;
  shortcutPath: string | null;
  interactiveHint: string;
} {
  const { appSlug, url, cacheDir, platform, env } = options;
  let command = options.executedCommand;
  let profileDir = "";
  try {
    profileDir = resolveStandaloneProfileDir(appSlug, cacheDir);
  } catch {
    profileDir = join(".agent", "apps", appSlug, "profile");
  }

  if (!command) {
    try {
      const binary = resolveFirefoxBinary(platform, env);
      const args = buildCleanStandaloneLaunchArgs({ profileDir, url });
      command = launchCommandHint(binary, args, platform);
    } catch {
      command = platform === "win32"
        ? `Start-Process -FilePath "firefox.exe" -ArgumentList @("--profile", "${profileDir}", "${url}")`
        : `firefox --profile "${profileDir}" "${url}" &`;
    }
  }

  let shortcutPath: string | null = options.executedShortcutPath ?? null;
  if (shortcutPath === null) {
    if (platform === "win32") {
      if (options.shortcutResolver) {
        shortcutPath = options.shortcutResolver(appSlug, profileDir);
      } else {
        shortcutPath = join(dirname(profileDir), `${appSlug}.lnk`);
      }
    } else {
      shortcutPath = null;
    }
  }

  let interactiveHint: string;
  if (platform === "win32") {
    interactiveHint = shortcutPath
      ? `Background harnesses run in isolated desktops. Run '${command}' or open '${shortcutPath}' in an interactive terminal.`
      : `Background harnesses run in isolated desktops. Run '${command}' in an interactive terminal.`;
  } else {
    interactiveHint = `If running headless in background harnesses, launch '${command}' in an interactive desktop session.`;
  }

  return { command, shortcutPath, interactiveHint };
}

export async function authTool(
  args: AuthArgs,
  ctx?: { mode?: string; cacheDir?: string },
  deps?: AuthToolDeps,
): Promise<ToolOutcome> {
  if (ctx?.mode === "offline") {
    throw new PwaNavError("invalid_args", "auth tool requires the live backend (--backend bidi).");
  }
  const app = args.app;
  const target = resolveAppTarget(app ?? "https://accounts.google.com");
  const cacheDir = args.cacheDir ?? ctx?.cacheDir;
  const isExplicitClean = args.clean === true || args.action === "clean";
  const platform = deps?.platform ?? process.platform;
  const env = deps?.env ?? process.env;

  // If not explicitly requesting clean mode, attempt cookie relay first
  if (!isExplicitClean) {
    const relayResult = await performAuthRelay({ appOrUrl: app, timeoutMs: args.timeoutMs, port: args.port });
    if (relayResult.status === "authenticated") {
      return {
        text: relayResult.message,
        structured: {
          status: relayResult.status,
          message: relayResult.message,
          ...(relayResult.command ? { command: relayResult.command } : {}),
          siteId: relayResult.siteId ?? target.slug,
          syncedCookies: relayResult.syncedCookies ?? 0,
        },
      };
    }
  }

  // Fallback to Assisted Auth clean -> wait for user login -> relaunch debug
  const orchestrator = deps?.orchestrator ?? new AuthWorkflowOrchestrator();
  const port = args.port ?? 9222;

  try {
    const execRes = (await orchestrator.execute({
      url: target.url,
      appSlug: target.slug,
      port,
      timeoutMs: args.timeoutMs,
      cacheDir,
    })) as Partial<AssistedAuthResult> | undefined;

    const interactive = computeInteractiveDetails({
      appSlug: target.slug,
      url: target.url,
      cacheDir,
      platform,
      env,
      shortcutResolver: deps?.shortcutResolver,
      executedCommand: execRes?.command,
      executedShortcutPath: execRes?.shortcutPath,
    });

    const successMsg = `PWA '${target.slug}' assisted authentication completed successfully. Browser restarted in debug mode on port ${String(port)}. ${interactive.interactiveHint}`;
    return {
      text: successMsg,
      structured: {
        status: "authenticated",
        message: successMsg,
        siteId: target.slug,
        port,
        assisted: true,
        command: interactive.command,
        shortcutPath: interactive.shortcutPath,
        interactiveHint: interactive.interactiveHint,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const interactive = computeInteractiveDetails({
      appSlug: target.slug,
      url: target.url,
      cacheDir,
      platform,
      env,
      shortcutResolver: deps?.shortcutResolver,
    });

    const failureMsg = `PWA '${target.slug}' assisted authentication failed: ${message}. ${interactive.interactiveHint}`;
    return {
      text: failureMsg,
      structured: {
        status: "unauthenticated",
        message: failureMsg,
        siteId: target.slug,
        assisted: true,
        error: message,
        command: interactive.command,
        shortcutPath: interactive.shortcutPath,
        interactiveHint: interactive.interactiveHint,
      },
    };
  }
}
