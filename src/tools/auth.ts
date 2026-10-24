import { PwaNavError } from "../core/errors.js";
import { performAuthRelay } from "../ops/ops.js";
import { resolveAppTarget } from "../backend/backend.js";
import { AuthWorkflowOrchestrator, type AssistedAuthOptions } from "../ops/auth-workflow.js";
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
    await orchestrator.execute({
      url: target.url,
      appSlug: target.slug,
      port,
      timeoutMs: args.timeoutMs,
      cacheDir,
    });

    const successMsg = `PWA '${target.slug}' assisted authentication completed successfully. Browser restarted in debug mode on port ${String(port)}.`;
    return {
      text: successMsg,
      structured: {
        status: "authenticated",
        message: successMsg,
        siteId: target.slug,
        port,
        assisted: true,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const failureMsg = `PWA '${target.slug}' assisted authentication failed: ${message}`;
    return {
      text: failureMsg,
      structured: {
        status: "unauthenticated",
        message: failureMsg,
        siteId: target.slug,
        assisted: true,
        error: message,
      },
    };
  }
}
