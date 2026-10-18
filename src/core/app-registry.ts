import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PwaNavError } from "./errors.js";
import { appSlugFromUrl } from "../backend/backend.js";

export const DEFAULT_AGENT_DIR = ".agent";

export interface AppDefinition {
  name?: string;
  origins: string[];
}

export interface AllowConfig {
  origins?: string[];
  apps?: Record<string, AppDefinition>;
}

/**
 * Normalizes an HTTP/HTTPS URL into its origin format (e.g. "https://example.com").
 * Returns null if the value cannot be parsed or lacks a valid HTTP(S) origin.
 */
export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin === "null" ? null : url.origin;
  } catch {
    return null;
  }
}

/**
 * Pure resolution logic: determines the canonical app slug for a given URL or origin
 * based on the declared AllowConfig, falling back to deterministic hostname slugging.
 */
export function resolveCanonicalSlug(urlOrOrigin: string, config: AllowConfig): string {
  const normalized = normalizeOrigin(urlOrOrigin);
  if (normalized !== null && config.apps) {
    for (const [slug, appDef] of Object.entries(config.apps)) {
      if (Array.isArray(appDef.origins)) {
        const matches = appDef.origins.some((o) => normalizeOrigin(o) === normalized);
        if (matches) {
          return slug;
        }
      }
    }
  }
  return appSlugFromUrl(urlOrOrigin);
}

/**
 * Pure helper to extract all unique, normalized allowed origins from AllowConfig.
 */
export function extractAllowedOrigins(config: AllowConfig): string[] {
  const result = new Set<string>();

  if (Array.isArray(config.origins)) {
    for (const o of config.origins) {
      const norm = normalizeOrigin(o);
      if (norm !== null) {
        result.add(norm);
      }
    }
  }

  if (config.apps && typeof config.apps === "object") {
    for (const appDef of Object.values(config.apps)) {
      if (Array.isArray(appDef.origins)) {
        for (const o of appDef.origins) {
          const norm = normalizeOrigin(o);
          if (norm !== null) {
            result.add(norm);
          }
        }
      }
    }
  }

  return [...result].sort();
}

/**
 * Service interface for canonical app and origin mapping.
 */
export interface AppRegistry {
  resolveSlug(urlOrOrigin: string): Promise<string>;
  registerAppOrigin(origin: string, appSlug: string, appName?: string): Promise<void>;
  getAllowedOrigins(): Promise<string[]>;
  load(): Promise<AllowConfig>;
}

/**
 * In-memory implementation of AppRegistry for isolated unit testing.
 */
export class MemoryAppRegistry implements AppRegistry {
  private config: AllowConfig;

  constructor(initialConfig: AllowConfig = {}) {
    this.config = {
      origins: [...(initialConfig.origins ?? [])],
      apps: { ...(initialConfig.apps ?? {}) },
    };
  }

  async load(): Promise<AllowConfig> {
    await Promise.resolve();
    return {
      origins: [...(this.config.origins ?? [])],
      apps: JSON.parse(JSON.stringify(this.config.apps ?? {})) as Record<string, AppDefinition>,
    };
  }

  async resolveSlug(urlOrOrigin: string): Promise<string> {
    await Promise.resolve();
    return resolveCanonicalSlug(urlOrOrigin, this.config);
  }

  async registerAppOrigin(origin: string, appSlug: string, appName?: string): Promise<void> {
    await Promise.resolve();
    const normalized = normalizeOrigin(origin);
    if (!normalized) {
      throw new PwaNavError("invalid_args", `invalid origin for registration: ${origin}`, {
        hint: "provide a valid http(s) origin such as https://example.com",
      });
    }

    if (!this.config.apps) {
      this.config.apps = {};
    }

    const currentApp = this.config.apps[appSlug] ?? { origins: [] };
    const originsSet = new Set(currentApp.origins.map((o) => normalizeOrigin(o) ?? o));
    originsSet.add(normalized);

    this.config.apps[appSlug] = {
      name: appName ?? currentApp.name,
      origins: [...originsSet].sort(),
    };
  }

  async getAllowedOrigins(): Promise<string[]> {
    await Promise.resolve();
    return extractAllowedOrigins(this.config);
  }
}

/**
 * Production implementation of AppRegistry persisting to .agent/allow.json.
 */
export class FileAppRegistry implements AppRegistry {
  private readonly agentDir: string;

  constructor(agentDir: string = DEFAULT_AGENT_DIR) {
    this.agentDir = agentDir;
  }

  private allowListPath(): string {
    return join(this.agentDir, "allow.json");
  }

  async load(): Promise<AllowConfig> {
    const file = this.allowListPath();
    try {
      const raw = await readFile(file, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new PwaNavError("invalid_args", `malformed ${file}: invalid JSON`, {
          hint: 'expected {"origins": ["https://example.com"]}',
          cause: err,
        });
      }

      if (!parsed || typeof parsed !== "object") {
        throw new PwaNavError("invalid_args", `malformed ${file}: root must be an object`);
      }

      const rawConfig = parsed as Record<string, unknown>;
      const origins: string[] = [];
      if (rawConfig.origins !== undefined) {
        if (!Array.isArray(rawConfig.origins) || !rawConfig.origins.every((o): o is string => typeof o === "string")) {
          throw new PwaNavError("invalid_args", `malformed ${file}: "origins" must be a string array`, {
            hint: 'expected {"origins": ["https://example.com"]}',
          });
        }
        origins.push(...rawConfig.origins);
      }

      const apps: Record<string, AppDefinition> = {};
      if (rawConfig.apps !== undefined) {
        if (typeof rawConfig.apps !== "object" || rawConfig.apps === null || Array.isArray(rawConfig.apps)) {
          throw new PwaNavError("invalid_args", `malformed ${file}: "apps" must be an object map`);
        }
        for (const [slug, val] of Object.entries(rawConfig.apps as Record<string, unknown>)) {
          if (!val || typeof val !== "object" || !Array.isArray((val as AppDefinition).origins)) {
            throw new PwaNavError("invalid_args", `malformed ${file}: app ${slug} must declare an "origins" array`);
          }
          const appVal = val as AppDefinition;
          apps[slug] = {
            ...(appVal.name ? { name: appVal.name } : {}),
            origins: appVal.origins.filter((o): o is string => typeof o === "string"),
          };
        }
      }

      return { origins, apps };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { origins: [], apps: {} };
      }
      if (err instanceof PwaNavError) {
        throw err;
      }
      throw new PwaNavError("invalid_args", `cannot read ${file}`, { cause: err });
    }
  }

  async resolveSlug(urlOrOrigin: string): Promise<string> {
    const config = await this.load();
    return resolveCanonicalSlug(urlOrOrigin, config);
  }

  async registerAppOrigin(origin: string, appSlug: string, appName?: string): Promise<void> {
    const normalized = normalizeOrigin(origin);
    if (!normalized) {
      throw new PwaNavError("invalid_args", `invalid origin for registration: ${origin}`, {
        hint: "provide a valid http(s) origin such as https://example.com",
      });
    }

    const config = await this.load();
    if (!config.apps) {
      config.apps = {};
    }

    const currentApp = config.apps[appSlug] ?? { origins: [] };
    const originsSet = new Set(currentApp.origins.map((o) => normalizeOrigin(o) ?? o));
    originsSet.add(normalized);

    config.apps[appSlug] = {
      name: appName ?? currentApp.name,
      origins: [...originsSet].sort(),
    };

    const file = resolve(this.allowListPath());
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${String(process.pid)}.tmp`;
    await writeFile(tmp, JSON.stringify(config, null, 2) + "\n", "utf8");
    await rename(tmp, file);
  }

  async getAllowedOrigins(): Promise<string[]> {
    const config = await this.load();
    return extractAllowedOrigins(config);
  }
}
