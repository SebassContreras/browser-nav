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

/**
 * Returns the default global user directory (~/.pwa-nav) to prevent cluttering $HOME.
 */
export function getGlobalDataDir(): string {
  return join(homedir(), ".pwa-nav");
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
 * 3. env.PWA_NAV_CACHE_DIR
 * 4. Project root: <projectRoot>/.agent
 * 5. Global fallback: ~/.pwa-nav
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

  const fromEnv = env.PWA_NAV_CACHE_DIR;
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
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
 * 2. env.PWA_NAV_SCREENS_DIR
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

  const fromEnv = env.PWA_NAV_SCREENS_DIR;
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
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
  const envCache = env.PWA_NAV_CACHE_DIR?.trim();

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

  const screensDir = options.screensDir?.trim()
    ? resolve(cwd, options.screensDir.trim())
    : env.PWA_NAV_SCREENS_DIR?.trim()
      ? resolve(cwd, env.PWA_NAV_SCREENS_DIR.trim())
      : join(agentDir, "screens");

  return {
    agentDir,
    screensDir,
    workspaceDir,
    mode,
  };
}
