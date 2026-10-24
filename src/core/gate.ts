import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { PwaNavError } from "./errors.js";
import { FileAppRegistry, extractAllowedOrigins } from "./app-registry.js";
import { readEnv } from "./storage.js";

export const DEFAULT_AGENT_DIR = ".agent";
export const CANONICAL_KILL_SWITCH_ENV = "BROWSER_NAV_KILL_SWITCH";
export const KILL_SWITCH_ENV = "PWA_NAV_KILL_SWITCH";

export type GateDecision =
  | { kind: "dry-run" }
  | { kind: "armed" }
  | { kind: "blocked"; error: PwaNavError };

export interface GateInput {
  armed: boolean;
  killSwitchActive: boolean;
  origin: string;
  allowedOrigins: readonly string[];
}

// Normalized origin, or null when not a parseable URL with a real origin.
export function normalizeOrigin(value: string): string | null {
  try {
    const { origin } = new URL(value);
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

// Pure decision core: no I/O. The kill-switch only aborts armed actions.
export function decideAction(input: GateInput): GateDecision {
  if (!input.armed) {
    return { kind: "dry-run" };
  }
  if (input.killSwitchActive) {
    return {
      kind: "blocked",
      error: new PwaNavError("kill_switch", "kill-switch is active; armed action aborted", {
        hint: "remove the kill-switch file to resume",
      }),
    };
  }
  const origin = normalizeOrigin(input.origin);
  const allowed = new Set(
    input.allowedOrigins.map(normalizeOrigin).filter((o): o is string => o !== null),
  );
  if (origin === null || !allowed.has(origin)) {
    const shown = origin ?? input.origin;
    return {
      kind: "blocked",
      error: new PwaNavError("origin_blocked", `origin not allow-listed: ${shown}`, {
        hint: `re-run: open <url> --allow-origin (adds ${origin ?? "<origin>"} to the allow-list)`,
      }),
    };
  }
  return { kind: "armed" };
}

export function killSwitchPath(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = readEnv(env, CANONICAL_KILL_SWITCH_ENV, KILL_SWITCH_ENV);
  return fromEnv !== undefined ? fromEnv : join(DEFAULT_AGENT_DIR, "kill");
}

export async function isKillSwitchActive(path: string = killSwitchPath()): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function allowListPath(agentDir: string): string {
  return join(agentDir, "allow.json");
}

export async function loadAllowList(
  agentDir: string = DEFAULT_AGENT_DIR,
  extraOrigins: readonly string[] = [],
): Promise<string[]> {
  const registry = new FileAppRegistry(agentDir);
  const origins = await registry.getAllowedOrigins();
  return [...new Set([...origins, ...extraOrigins])];
}

// Adds a normalized http(s) origin; idempotent, sorted, temp file + rename.
export async function addAllowedOrigin(
  origin: string,
  agentDir: string = DEFAULT_AGENT_DIR,
): Promise<string[]> {
  const normalized = normalizeOrigin(origin);
  if (normalized === null || !/^https?:\/\//.test(normalized)) {
    throw new PwaNavError("invalid_args", `invalid origin for --allow-origin: ${origin}`, {
      hint: "use an http(s) origin such as https://example.com",
    });
  }
  const registry = new FileAppRegistry(agentDir);
  const config = await registry.load();
  const currentOrigins = config.origins ?? [];
  const nextOrigins = [
    ...new Set([...currentOrigins.map((o) => normalizeOrigin(o) ?? o), normalized]),
  ].sort();
  config.origins = nextOrigins;

  const file = resolve(allowListPath(agentDir));
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${String(process.pid)}.tmp`;
  const output: { origins: string[]; apps?: typeof config.apps } = { origins: nextOrigins };
  if (config.apps && Object.keys(config.apps).length > 0) {
    output.apps = config.apps;
  }
  await writeFile(tmp, JSON.stringify(output, null, 2) + "\n", "utf8");
  await rename(tmp, file);
  return extractAllowedOrigins(config);
}

export interface AssertArmedOptions {
  armed: boolean;
  origin: string;
  agentDir?: string;
  env?: NodeJS.ProcessEnv;
  extraOrigins?: readonly string[];
}

// Per-action check: re-reads kill-switch and allow-list each call, so a
// kill file created mid-batch stops the remaining actions.
export async function assertArmedAllowed(options: AssertArmedOptions): Promise<GateDecision> {
  if (!options.armed) {
    return { kind: "dry-run" };
  }
  const [killSwitchActive, allowedOrigins] = await Promise.all([
    isKillSwitchActive(killSwitchPath(options.env)),
    loadAllowList(options.agentDir, options.extraOrigins),
  ]);
  return decideAction({
    armed: true,
    killSwitchActive,
    origin: options.origin,
    allowedOrigins,
  });
}

export interface AssertNavigationOptions {
  /** URL (or origin) being opened. */
  url: string;
  /** `--allow-origin` passed on this same call: consent to navigate there. */
  allowOrigin: boolean;
  agentDir?: string;
  env?: NodeJS.ProcessEnv;
  extraOrigins?: readonly string[];
}

// `open` navigates the user's real window: kill-switch blocks it, and the origin must be
// allow-listed or consented via --allow-origin on this call. No --armed needed. Runs before any I/O to the browser.
export async function assertNavigationAllowed(options: AssertNavigationOptions): Promise<void> {
  if (await isKillSwitchActive(killSwitchPath(options.env))) {
    throw new PwaNavError("kill_switch", "kill-switch is active; navigation aborted", {
      hint: "remove the kill-switch file to resume",
    });
  }
  const origin = normalizeOrigin(options.url);
  if (origin === null) {
    throw new PwaNavError("invalid_args", `invalid URL (expected http/https): ${options.url}`);
  }
  if (options.allowOrigin) return;
  const allowed = (await loadAllowList(options.agentDir, options.extraOrigins)).map(normalizeOrigin);
  if (!allowed.includes(origin)) {
    throw new PwaNavError("origin_blocked", `origin not allow-listed: ${origin}`, {
      hint: "re-run: open <url> --allow-origin to allow this origin",
    });
  }
}

const FORBIDDEN_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa",
]);

export function isPathInside(targetPath: string, rootDir: string): boolean {
  const targetResolved = resolve(targetPath);
  const rootResolved = resolve(rootDir);
  const rel = process.platform === "win32"
    ? relative(rootResolved.toLowerCase(), targetResolved.toLowerCase())
    : relative(rootResolved, targetResolved);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function assertFileUploadAllowed(
  filePath: string,
  safeRoots: readonly string[] = [process.cwd(), resolve(DEFAULT_AGENT_DIR)],
): void {
  const resolved = resolve(filePath);
  const base = basename(resolved).toLowerCase();
  if (base.startsWith(".env") || FORBIDDEN_FILE_NAMES.has(base)) {
    throw new PwaNavError("file_upload_blocked", `upload of sensitive file ${filePath} is blocked`, {
      hint: "Sensitive files (.env, private keys) cannot be uploaded.",
    });
  }

  const isInside = safeRoots.some((root) => isPathInside(resolved, root));
  if (!isInside) {
    throw new PwaNavError("file_upload_blocked", `file ${filePath} is outside allowed upload paths`, {
      hint: "Files can only be uploaded from workspace root or .agent/ directory.",
    });
  }
}

