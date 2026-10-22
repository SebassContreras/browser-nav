import { resolveEffectiveStorage, type EffectiveStorage, type StorageOptions } from "../core/storage.js";

export interface ConfigOptions extends StorageOptions {
  action?: "get" | "set" | undefined;
}

export interface ConfigResult {
  active: EffectiveStorage;
  previous?: EffectiveStorage | undefined;
  updated: boolean;
}

/**
 * Pure operation to inspect or update storage configuration.
 */
export function performConfig(
  options: ConfigOptions,
  currentContext: { cacheDir?: string | undefined; screensDir?: string | undefined; workspaceDir?: string | undefined } = {},
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): ConfigResult {
  const current = resolveEffectiveStorage(currentContext, env, cwd);

  const isSet =
    options.action === "set" ||
    (options.action === undefined &&
      (options.cacheDir !== undefined || options.workspaceDir !== undefined || options.screensDir !== undefined));

  if (!isSet) {
    return {
      active: current,
      updated: false,
    };
  }

  // When setting workspaceDir explicitly without an explicit cacheDir, clear previous custom cacheDir
  const nextCacheDir =
    options.cacheDir !== undefined
      ? options.cacheDir
      : options.workspaceDir !== undefined
        ? undefined
        : currentContext.cacheDir;

  const nextWorkspaceDir =
    options.workspaceDir !== undefined
      ? options.workspaceDir
      : options.cacheDir !== undefined
        ? undefined
        : currentContext.workspaceDir;

  // When updating cacheDir/workspaceDir without explicit screensDir, allow screensDir to re-default
  const nextScreensDir = options.screensDir !== undefined ? options.screensDir : undefined;

  const updatedOptions: StorageOptions = {
    cacheDir: nextCacheDir,
    workspaceDir: nextWorkspaceDir,
    screensDir: nextScreensDir,
  };

  const next = resolveEffectiveStorage(updatedOptions, env, cwd);

  return {
    active: next,
    previous: current,
    updated: true,
  };
}
