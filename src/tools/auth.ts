import { PwaNavError } from "../core/errors.js";
import { performAuthRelay } from "../ops/ops.js";
import { type ToolOutcome } from "./types.js";

export interface AuthArgs {
  app?: string;
  timeoutMs?: number;
}

export async function authTool(args: AuthArgs, ctx?: { mode?: string }): Promise<ToolOutcome> {
  if (ctx?.mode === "offline") {
    throw new PwaNavError("invalid_args", "auth tool requires the live backend (--backend bidi).");
  }
  const app = args.app;
  const result = await performAuthRelay({ appOrUrl: app, timeoutMs: args.timeoutMs });

  return {
    text: result.message,
    structured: {
      status: result.status,
      message: result.message,
      ...(result.command ? { command: result.command } : {}),
      ...(result.siteId ? { siteId: result.siteId } : {}),
    },
  };
}
