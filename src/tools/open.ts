import { join } from "node:path";
import { isLoginBarrier } from "../browser/pwa-runtime.js";
import { FileAppRegistry, normalizeOrigin } from "../core/app-registry.js";
import { resolveNavigationTarget } from "../core/target-resolution.js";
import { performOpen } from "../ops/ops.js";
import { getBackend } from "./common.js";
import { invalid, type CommonToolOptions, type ToolContext, type ToolOutcome } from "./types.js";

export interface OpenArgs extends CommonToolOptions {
  url: string;
  launch?: boolean;
  allowOrigin?: boolean;
  port?: number;
  app?: string;
}

export async function openTool(args: OpenArgs, ctx: ToolContext): Promise<ToolOutcome> {
  const { url: rawUrl, launch = false, allowOrigin = false, port, app: explicitApp, cacheDir, workspaceDir } = args;
  if (!rawUrl || rawUrl.length === 0) {
    throw invalid("missing <url>.");
  }
  if (ctx.mode === "offline" && (launch || allowOrigin)) {
    throw invalid("--launch and --allow-origin require the live backend (--backend bidi).");
  }

  // Pre-navigation target resolution and validation (fail-fast without spawning processes or tabs)
  const probeBackend = getBackend(ctx, { armed: false, launch: false, port, app: explicitApp, cacheDir, workspaceDir });
  const preRegistry = new FileAppRegistry(probeBackend.agentDir);
  const resolved = await resolveNavigationTarget(rawUrl, preRegistry);

  const initialTargetSlug = resolved.appSlug || undefined;
  const targetUrl = resolved.url;
  const effectiveApp = explicitApp ?? initialTargetSlug;

  const backend = getBackend(ctx, { armed: false, launch, port, app: effectiveApp, cacheDir, workspaceDir });
  const session = await performOpen(targetUrl, { backend, allowOrigin });
  const registry = new FileAppRegistry(backend.agentDir);
  const barrier = isLoginBarrier(session.url);
  const initialOrigin = normalizeOrigin(targetUrl);
  const destOrigin = normalizeOrigin(session.url);

  let slug: string;
  if (explicitApp) {
    if (initialOrigin) {
      await registry.registerAppOrigin(initialOrigin, explicitApp);
    }
    if (destOrigin && !barrier) {
      await registry.registerAppOrigin(destOrigin, explicitApp);
    }
    slug = explicitApp;
  } else if (!barrier && initialOrigin && destOrigin && initialOrigin !== destOrigin) {
    const destSlug = await registry.resolveSlug(session.url);
    await registry.registerAppOrigin(initialOrigin, destSlug);
    slug = destSlug;
  } else if (initialTargetSlug) {
    if (initialOrigin) {
      await registry.registerAppOrigin(initialOrigin, initialTargetSlug);
    }
    if (destOrigin && !barrier) {
      await registry.registerAppOrigin(destOrigin, initialTargetSlug);
    }
    slug = initialTargetSlug;
  } else {
    slug = await registry.resolveSlug(barrier ? targetUrl : session.url);
  }

  const sessionPath = join(backend.agentDir, "session.json");
  const textLines = [`open ok: ${session.url} -> ${sessionPath}`];
  if (barrier) {
    textLines.push(
      "Login barrier detected (e.g. Google accounts login). Run 'browser-nav auth <app>' (or browser_auth) to perform assisted login, then resume automation.",
    );
  }

  return {
    text: textLines.join("\n"),
    structured: {
      url: session.url,
      screenMap: join(backend.agentDir, "apps", slug, "screens.json"),
      ...(barrier
        ? {
            loginBarrier: true,
            hint: "Login barrier detected (e.g. Google accounts login). Run 'browser-nav auth <app>' (or browser_auth) to perform assisted login, then resume automation.",
          }
        : {}),
    },
  };
}
