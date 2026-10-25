// Session health status (spec 007 D4): zero-launch, read-only check of an app's stored cookies.
// Shared by the CLI (`browser-nav status <app>`) and MCP (`browser_auth({ action: "status" })`).
import { resolveAppTarget } from "../backend/backend.js";
import { evaluateSessionHealth } from "../browser/session-health.js";
import { readProfileCookies } from "../browser/session-reader.js";
import { resolveStandaloneProfileDir } from "../browser/standalone-profile.js";
import { PwaNavError } from "../core/errors.js";
import { type ToolOutcome } from "./types.js";

export interface StatusArgs {
  app?: string;
  cookies?: readonly string[];
}

export interface StatusOptions {
  cacheDir?: string;
  nowMs?: number;
}

export async function statusTool(args: StatusArgs, options: StatusOptions = {}): Promise<ToolOutcome> {
  if (args.app === undefined || args.app === "") {
    throw new PwaNavError("invalid_args", "status needs an app name or URL", { hint: "browser-nav status <app>" });
  }
  const target = resolveAppTarget(args.app);
  const profileDir = resolveStandaloneProfileDir(target.slug, options.cacheDir);
  const health = evaluateSessionHealth(await readProfileCookies(profileDir), {
    host: target.host,
    nowMs: options.nowMs ?? Date.now(),
    ...(args.cookies === undefined ? {} : { authCookieNames: args.cookies }),
    signInHint: `browser-nav auth ${args.app} (MCP: browser_auth({ action: "clean", app: "${args.app}" }))`,
  });

  const ttl = health.ttlSeconds === undefined || health.ttlSeconds === 0 ? "" : ` (expires in ${formatTtl(health.ttlSeconds)})`;
  const names = health.cookies.length === 0 ? "" : `\ncookies: ${health.cookies.map((c) => c.name).join(", ")}`;
  const hint = health.hint === undefined ? "" : `\nhint: ${health.hint}`;
  return {
    text: `${target.slug}: ${health.verdict}${ttl}${names}${hint}`,
    structured: { app: target.slug, host: target.host, ...health },
  };
}

function formatTtl(seconds: number): string {
  if (seconds >= 86_400) return `${String(Math.floor(seconds / 86_400))}d`;
  if (seconds >= 3_600) return `${String(Math.floor(seconds / 3_600))}h`;
  if (seconds >= 60) return `${String(Math.floor(seconds / 60))}m`;
  return `${String(seconds)}s`;
}
