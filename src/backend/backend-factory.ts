import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HOST, DEFAULT_PORT, OfflineBackend, type Backend } from "./backend.js";
import { BidiBackend } from "../browser/bidi-backend.js";
import { resolveAgentDir } from "../core/storage.js";
import type { PwaInstance } from "../browser/port-allocator.js";

export { DEFAULT_HOST, DEFAULT_PORT };

export interface CreateBackendOptions {
  mode: "offline" | "bidi";
  port?: number;
  app?: string;
  host?: string;
  contextId?: string;
  armed?: boolean;
  launch?: boolean;
  /** `--cache-dir` (env PWA_NAV_CACHE_DIR). */
  cacheDir?: string;
  env?: NodeJS.ProcessEnv;
}

function resolveAppPort(agentDir: string, appSlug: string): number | undefined {
  try {
    const registryPath = join(agentDir, "instances.json");
    const raw = readFileSync(registryPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const entry = (parsed as Record<string, PwaInstance | undefined>)[appSlug];
      if (typeof entry?.port === "number") {
        return entry.port;
      }
    }
  } catch {
    // Registry missing or unreadable, fallback to undefined
  }
  return undefined;
}

export function createBackend(options: CreateBackendOptions): Backend {
  const agentDir = resolveAgentDir({ cacheDir: options.cacheDir });
  if (options.mode === "offline") {
    return new OfflineBackend({ agentDir });
  }

  let resolvedPort = options.port;
  if (resolvedPort === undefined && options.app) {
    resolvedPort = resolveAppPort(agentDir, options.app);
  }

  return new BidiBackend({
    port: resolvedPort ?? DEFAULT_PORT,
    host: options.host ?? DEFAULT_HOST,
    agentDir,
    ...(options.contextId === undefined ? {} : { contextId: options.contextId }),
    ...(options.armed === undefined ? {} : { armed: options.armed }),
    ...(options.launch === undefined ? {} : { launch: options.launch }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });
}

/** Startup defaults for a backend factory; `armed`/`launch` are per-request only. */
export type BackendDefaults = Omit<CreateBackendOptions, "armed" | "launch">;

export interface BackendFactoryRequest {
  armed?: boolean | undefined;
  launch?: boolean | undefined;
  port?: number | undefined;
  app?: string | undefined;
  /** Active `.agent` dir chosen by the caller (per-call override, browser_config or handshake). */
  cacheDir?: string | undefined;
}

/** Builds backends from startup defaults; request fields win, so runtime workspace switches reach storage. */
export function createBackendFactory(defaults: BackendDefaults): (request: BackendFactoryRequest) => Backend {
  return (request) => {
    const app = request.app ?? defaults.app;
    const cacheDir = request.cacheDir ?? defaults.cacheDir;
    return createBackend({
      ...defaults,
      port: request.port ?? defaults.port,
      ...(app === undefined ? {} : { app }),
      ...(cacheDir === undefined ? {} : { cacheDir }),
      ...(request.armed === undefined ? {} : { armed: request.armed }),
      ...(request.launch === true ? { launch: true } : {}),
    });
  };
}
