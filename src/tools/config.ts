import { performConfig, type ConfigOptions, type ConfigResult } from "../ops/config.js";
import type { ToolContext, ToolOutcome } from "./types.js";

export function configTool(
  args: ConfigOptions,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  return Promise.resolve(performConfigTool(args, ctx));
}

function performConfigTool(
  args: ConfigOptions,
  ctx: ToolContext,
): ToolOutcome {
  const currentContext = {
    cacheDir: ctx.screens.workspaceDir !== undefined ? undefined : (ctx.screens.cacheDir ?? ctx.agentDir),
    workspaceDir: ctx.screens.workspaceDir,
    screensDir: ctx.screens.screensDir,
  };

  const result: ConfigResult = performConfig(args, currentContext);

  if (result.updated) {
    // Atomically synchronize the active session context
    ctx.agentDir = result.active.agentDir;
    ctx.screens.cacheDir = result.active.agentDir;
    ctx.screens.screensDir = result.active.screensDir;
    ctx.screens.workspaceDir = result.active.workspaceDir ?? undefined;
  }

  const lines = [
    result.updated ? "Configuration updated:" : "Active configuration:",
    `  mode: ${result.active.mode}`,
    `  agentDir: ${result.active.agentDir}`,
    `  screensDir: ${result.active.screensDir}`,
    `  workspaceDir: ${result.active.workspaceDir ?? "none (outside project or global fallback)"}`,
  ];

  return {
    text: lines.join("\n"),
    structured: {
      ...result,
      agentDir: result.active.agentDir,
      screensDir: result.active.screensDir,
      workspaceDir: result.active.workspaceDir,
      mode: result.active.mode,
    },
  };
}
