import type { Backend } from "../backend/backend.js";
import type { RuntimeInstaller } from "../browser/runtime-installer.js";
import { PwaNavError } from "../core/errors.js";

export interface BackendRequest {
  armed: boolean;
  launch?: boolean;
  port?: number;
  app?: string;
  cacheDir?: string;
  workspaceDir?: string;
}

export type BackendFactory = (request: BackendRequest) => Backend;

export interface ScreenSource {
  /** `--screen-map <file>`; wins over directory selection. */
  screenMap?: string;
  /** `--screens-dir <dir>` (env PWA_NAV_SCREENS_DIR, default <cache-dir>/screens). */
  screensDir?: string | undefined;
  /** Resolved `--cache-dir` (env PWA_NAV_CACHE_DIR). */
  cacheDir?: string;
  /** Workspace directory if bound to a project root. */
  workspaceDir?: string | undefined;
}

export interface CommonToolOptions {
  cacheDir?: string | undefined;
  workspaceDir?: string | undefined;
}

export interface ToolContext {
  backendFactory: BackendFactory;
  /** Operator-level (CLI flag / env). Never a tool argument. */
  armed: boolean;
  mode: "offline" | "bidi";
  screens: ScreenSource;
  agentDir?: string;
  backend?: Backend;
  port?: number;
  app?: string;
  /** Asks the human a yes/no question (MCP elicitation). Absent when the client cannot ask. */
  confirm?: (message: string) => Promise<boolean>;
  /** Firefox runtime installer override (tests). */
  runtimeInstaller?: RuntimeInstaller;
}

export interface ToolOutcome {
  /** Human-readable text representation (e.g. for CLI stdout or MCP text block). */
  text?: string;
  /** Structured output for machine/agent consumers. */
  structured: Record<string, unknown>;
}

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export const ACTION_HINTS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export const READONLY_HINTS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function invalid(message: string, hint?: string): PwaNavError {
  return new PwaNavError("invalid_args", message, hint !== undefined ? { hint } : undefined);
}

export const NO_INPUT_LINE = "no input sent (pass --armed to execute)";

export function isDryRun(ctx: ToolContext): boolean {
  return ctx.mode === "bidi" && !ctx.armed;
}
