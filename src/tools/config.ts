import { performConfig, type ConfigOptions, type ConfigResult } from "../ops/config.js";
import type { ToolContext, ToolOutcome } from "./types.js";

export interface ExtendedConfigOptions extends ConfigOptions {
  contextId?: string | undefined;
}

export function configTool(
  args: ExtendedConfigOptions,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  return Promise.resolve(performConfigTool(args, ctx));
}

function performConfigTool(
  args: ExtendedConfigOptions,
  ctx: ToolContext,
): ToolOutcome {
  const currentContext = {
    cacheDir: ctx.screens.workspaceDir !== undefined ? undefined : (ctx.screens.cacheDir ?? ctx.agentDir),
    workspaceDir: ctx.screens.workspaceDir,
    screensDir: ctx.screens.screensDir,
  };

  const result: ConfigResult = performConfig(args, currentContext);
  let updated = result.updated;

  if (args.action === "set" || (args.action === undefined && args.contextId !== undefined)) {
    if (args.contextId !== undefined && args.contextId !== ctx.contextId) {
      ctx.contextId = args.contextId;
      updated = true;
    }
  }

  if (result.updated) {
    // Atomically synchronize the active session context
    ctx.agentDir = result.active.agentDir;
    ctx.screens.cacheDir = result.active.agentDir;
    ctx.screens.screensDir = result.active.screensDir;
    ctx.screens.workspaceDir = result.active.workspaceDir ?? undefined;
  }

  const lines = [
    updated ? "Configuration updated:" : "Active configuration:",
    `  mode: ${result.active.mode}`,
    `  agentDir: ${result.active.agentDir}`,
    `  screensDir: ${result.active.screensDir}`,
    `  workspaceDir: ${result.active.workspaceDir ?? "none (outside project or global fallback)"}`,
    `  contextId: ${ctx.contextId ?? "none"}`,
  ];

  return {
    text: lines.join("\n"),
    structured: {
      ...result,
      updated,
      agentDir: result.active.agentDir,
      screensDir: result.active.screensDir,
      workspaceDir: result.active.workspaceDir,
      mode: result.active.mode,
      contextId: ctx.contextId ?? null,
    },
  };
}
