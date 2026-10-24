import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface StorageOptions {
  cacheDir?: string | undefined;
  screensDir?: string | undefined;
  workspaceDir?: string | undefined;
}

export interface EffectiveStorage {
  agentDir: string;
  screensDir: string;
  workspaceDir: string | null;
  mode: "workspace" | "custom" | "fallback";
}

/**
 * Searches upward from startDir for project root markers (.git, .agent, package.json, pnpm-workspace.yaml).
 * Returns the project root directory or null if outside a project.
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = resolve(startDir);
  const home = resolve(homedir());

  for (;;) {
    // If we hit homedir, do not treat it as a project root unless .git exists directly in homedir
    if (current === home) {
      if (existsSync(join(current, ".git"))) {
        return current;
      }
      return null;
    }

    if (
      existsSync(join(current, ".git")) ||
      existsSync(join(current, ".agent")) ||
      existsSync(join(current, "package.json")) ||
      existsSync(join(current, "pnpm-workspace.yaml"))
    ) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }
    current = parent;
  }
}

export const CANONICAL_GLOBAL_DIR_NAME = ".browser-nav";
export const LEGACY_GLOBAL_DIR_NAME = ".pwa-nav";

/**
 * Pure environment variable lookup: prefers the canonical key (e.g. BROWSER_NAV_*),
 * seamlessly falling back to the legacy key (e.g. PWA_NAV_*) when unset or empty.
 */
export function readEnv(
  env: Readonly<Record<string, string | undefined>>,
  canonicalKey: string,
  legacyKey: string,
): string | undefined {
  const canonical = env[canonicalKey];
  if (canonical !== undefined && canonical.trim() !== "") {
    return canonical;
  }
  const legacy = env[legacyKey];
  if (legacy !== undefined && legacy.trim() !== "") {
    return legacy;
  }
  return undefined;
}

/**
 * Returns the default global user directory (~/.browser-nav), falling back to
 * ~/.pwa-nav if ~/.pwa-nav already exists on disk and ~/.browser-nav does not.
 */
export function getGlobalDataDir(
  home: string = homedir(),
  checkExists: (path: string) => boolean = existsSync,
): string {
  const canonicalDir = join(home, CANONICAL_GLOBAL_DIR_NAME);
  if (checkExists(canonicalDir)) {
    return canonicalDir;
  }
  const legacyDir = join(home, LEGACY_GLOBAL_DIR_NAME);
  if (checkExists(legacyDir)) {
    return legacyDir;
  }
  return canonicalDir;
}

/**
 * Resolves the canonical screen map path for a specific application slug:
 * <agentDir>/apps/<appSlug>/screens.json
 */
export function resolveAppScreenMapPath(agentDir: string, appSlug: string): string {
  return join(agentDir, "apps", appSlug, "screens.json");
}

/**
 * Resolves the agent data directory given an explicit workspace directory.
 * Maps <workspaceDir> to <workspaceDir>/.agent.
 */
export function resolveWorkspaceAgentDir(workspaceDir: string): string {
  return join(resolve(workspaceDir), ".agent");
}

/**
 * Resolves the cache directory (cache, snapshots, session, allow-list, screen maps):
 * 1. options.cacheDir (--cache-dir)
 * 2. options.workspaceDir -> <workspaceDir>/.agent
 * 3. env.BROWSER_NAV_CACHE_DIR (fallback: env.PWA_NAV_CACHE_DIR)
 * 4. Project root: <projectRoot>/.agent
 * 5. Global fallback: ~/.browser-nav (fallback: ~/.pwa-nav if existing)
 */
export function resolveAgentDir(
  options: { cacheDir?: string | undefined; workspaceDir?: string | undefined } = {},
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): string {
  const fromCacheOption = options.cacheDir;
  if (fromCacheOption !== undefined && fromCacheOption.trim() !== "") {
    return resolve(cwd, fromCacheOption);
  }

  const fromWorkspaceOption = options.workspaceDir;
  if (fromWorkspaceOption !== undefined && fromWorkspaceOption.trim() !== "") {
    return resolveWorkspaceAgentDir(resolve(cwd, fromWorkspaceOption));
  }

  const fromEnv = readEnv(env, "BROWSER_NAV_CACHE_DIR", "PWA_NAV_CACHE_DIR");
  if (fromEnv !== undefined) {
    return resolve(cwd, fromEnv);
  }

  const projectRoot = findProjectRoot(cwd);
  if (projectRoot !== null) {
    return join(projectRoot, ".agent");
  }

  return getGlobalDataDir();
}

/**
 * Resolves the screens directory:
 * 1. options.screensDir
 * 2. env.BROWSER_NAV_SCREENS_DIR (fallback: env.PWA_NAV_SCREENS_DIR)
 * 3. Default: <cache-dir>/screens
 */
export function resolveScreensDir(
  options: { screensDir?: string | undefined; cacheDir?: string | undefined; workspaceDir?: string | undefined } = {},
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): string {
  const fromOption = options.screensDir;
  if (fromOption !== undefined && fromOption.trim() !== "") {
    return resolve(cwd, fromOption);
  }

  const fromEnv = readEnv(env, "BROWSER_NAV_SCREENS_DIR", "PWA_NAV_SCREENS_DIR");
  if (fromEnv !== undefined) {
    return resolve(cwd, fromEnv);
  }

  return join(resolveAgentDir({ cacheDir: options.cacheDir, workspaceDir: options.workspaceDir }, env, cwd), "screens");
}

/**
 * Computes the complete effective storage configuration including resolution mode and paths.
 */
export function resolveEffectiveStorage(
  options: StorageOptions = {},
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): EffectiveStorage {
  const explicitCache = options.cacheDir?.trim();
  const explicitWorkspace = options.workspaceDir?.trim();
  const envCache = readEnv(env, "BROWSER_NAV_CACHE_DIR", "PWA_NAV_CACHE_DIR")?.trim();

  let agentDir: string;
  let workspaceDir: string | null = null;
  let mode: "workspace" | "custom" | "fallback";

  if (explicitCache) {
    agentDir = resolve(cwd, explicitCache);
    mode = "custom";
  } else if (explicitWorkspace) {
    const resolvedWorkspace = resolve(cwd, explicitWorkspace);
    agentDir = resolveWorkspaceAgentDir(resolvedWorkspace);
    workspaceDir = resolvedWorkspace;
    mode = "workspace";
  } else if (envCache) {
    agentDir = resolve(cwd, envCache);
    mode = "custom";
  } else {
    const detectedRoot = findProjectRoot(cwd);
    if (detectedRoot !== null) {
      agentDir = join(detectedRoot, ".agent");
      workspaceDir = detectedRoot;
      mode = "workspace";
    } else {
      agentDir = getGlobalDataDir();
      mode = "fallback";
    }
  }

  const envScreens = readEnv(env, "BROWSER_NAV_SCREENS_DIR", "PWA_NAV_SCREENS_DIR")?.trim();
  const screensDir = options.screensDir?.trim()
    ? resolve(cwd, options.screensDir.trim())
    : envScreens
      ? resolve(cwd, envScreens)
      : join(agentDir, "screens");

  return {
    agentDir,
    screensDir,
    workspaceDir,
    mode,
  };
}
