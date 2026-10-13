// Firefox runtime tools (spec 015): status and install of the pwa-nav managed runtime.
// Shared by the CLI (`runtime status|install`) and the MCP server (`pwa_install_runtime`).
import { type Env, locateFirefox, managedRuntimeBinary } from "../browser/pwa-runtime.js";
import { createRuntimeInstaller, type InstallProgress, type RuntimeInstaller } from "../browser/runtime-installer.js";
import { type ToolOutcome } from "./types.js";

export interface RuntimeToolOptions {
  platform?: string;
  env?: Env;
  installer?: RuntimeInstaller;
  onProgress?: (progress: InstallProgress) => void;
}

function installerFor(options: RuntimeToolOptions): RuntimeInstaller {
  return options.installer ?? createRuntimeInstaller(options.platform ?? process.platform, options.env ?? process.env);
}

export async function runtimeStatusTool(options: RuntimeToolOptions = {}): Promise<ToolOutcome> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const found = locateFirefox(platform, env);
  const managedVersion = await installerFor(options).installedVersion();
  const managed = managedRuntimeBinary(platform, env);
  const text =
    found === undefined
      ? "firefox: not found (run `pwa-nav runtime install`, MCP: pwa_install_runtime)"
      : `firefox: ${found.binary} (${found.source})`;
  return {
    text: managedVersion === undefined ? text : `${text}\nmanaged runtime: ${managedVersion}`,
    structured: {
      found: found !== undefined,
      ...(found === undefined ? {} : { binary: found.binary, source: found.source }),
      ...(managed === undefined ? {} : { managedBinary: managed }),
      ...(managedVersion === undefined ? {} : { managedVersion }),
    },
  };
}

export async function runtimeInstallTool(options: RuntimeToolOptions = {}): Promise<ToolOutcome> {
  const result = await installerFor(options).install(options.onProgress);
  const mb = (result.bytes / 1_000_000).toFixed(0);
  return {
    text: `firefox ${result.version} installed for pwa-nav: ${result.binary} (${mb} MB downloaded)`,
    structured: { version: result.version, binary: result.binary, bytes: result.bytes },
  };
}
