import { join } from "node:path";
import { isLoginBarrier } from "../browser/pwa-runtime.js";
import { FileAppRegistry, normalizeOrigin } from "../core/app-registry.js";
import { performOpen } from "../ops/ops.js";
import { getBackend } from "./common.js";
import { invalid, type ToolContext, type ToolOutcome } from "./types.js";

export interface OpenArgs {
  url: string;
  launch?: boolean;
  allowOrigin?: boolean;
  port?: number;
  app?: string;
}

export async function openTool(args: OpenArgs, ctx: ToolContext): Promise<ToolOutcome> {
  const { url, launch = false, allowOrigin = false, port, app } = args;
  if (!url || url.length === 0) {
    throw invalid("missing <url>.");
  }
  if (ctx.mode === "offline" && (launch || allowOrigin)) {
    throw invalid("--launch and --allow-origin require the live backend (--backend bidi).");
  }

  const backend = getBackend(ctx, { armed: false, launch, port, app });
  const session = await performOpen(url, { backend, allowOrigin });
  const registry = new FileAppRegistry(backend.agentDir);
  const barrier = isLoginBarrier(session.url);
  const initialOrigin = normalizeOrigin(url);
  const destOrigin = normalizeOrigin(session.url);

  let slug: string;
  if (app) {
    if (initialOrigin) {
      await registry.registerAppOrigin(initialOrigin, app);
    }
    if (destOrigin && !barrier) {
      await registry.registerAppOrigin(destOrigin, app);
    }
    slug = app;
  } else if (!barrier && initialOrigin && destOrigin && initialOrigin !== destOrigin) {
    const destSlug = await registry.resolveSlug(session.url);
    await registry.registerAppOrigin(initialOrigin, destSlug);
    slug = destSlug;
  } else {
    slug = await registry.resolveSlug(barrier ? url : session.url);
  }

  const sessionPath = join(backend.agentDir, "session.json");
  const textLines = [`open ok: ${session.url} -> ${sessionPath}`];
  if (barrier) {
    textLines.push(
      "Login barrier detected (e.g. Google accounts login). Use auth clean to switch to clean mode for manual user login, then auth debug to resume automation.",
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
            hint: "Login barrier detected (e.g. Google accounts login). Use auth clean to switch to clean mode for manual user login, then auth debug to resume automation.",
          }
        : {}),
    },
  };
}
