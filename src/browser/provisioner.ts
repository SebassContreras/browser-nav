import { join } from "node:path";
import { appSlugFromUrl } from "../backend/backend.js";
import { ensureStandaloneProfile } from "./standalone-profile.js";
import { type Env, resolveFirefoxBinary } from "./pwa-runtime.js";
import {
  buildStandaloneLaunchArgs,
  launchStandaloneApp,
  type StandaloneLaunchOptions,
  type StandaloneLaunchResult,
} from "./standalone-runner.js";
import { type AppIconService, DefaultAppIconService } from "./app-icon.js";
import { type AppShortcutService, WindowsShortcutService } from "./app-shortcut.js";
import type { AppRegistry } from "../core/app-registry.js";
import { locateDefaultFirefoxProfile } from "./firefox-profile-discovery.js";
import { FirefoxCookieExtractor } from "./cookie-extractor.js";
import { CookieSyncService } from "./cookie-sync.js";

/**
 * Domain specification and runtime configuration for an isolated standalone PWA.
 */
export interface ProvisionedPwa {
  url: string;
  appSlug: string;
  profileDir: string;
  iconPath?: string | null;
  shortcutPath?: string | null;
  cookiesSeeded?: number;
}

/**
 * Options for provisioning a target URL as a standalone PWA.
 */
export interface ProvisionOptions {
  cacheDir?: string;
  port?: number;
  launchOptions?: Partial<StandaloneLaunchOptions>;
}

/**
 * Result of provisioning and optionally launching a standalone PWA.
 */
export interface ProvisionResult extends ProvisionedPwa {
  launchResult?: StandaloneLaunchResult;
}

/**
 * Anti-corruption service layer interface for PWA provisioning.
 * Abstracts on-the-fly registration, profile setup, and execution.
 */
export interface PwaProvisioner {
  /**
   * Resolves the app slug for a given target URL.
   */
  resolveSlug(url: string): string | Promise<string>;

  /**
   * Prepares the isolated profile for the target URL.
   */
  provision(url: string, options?: ProvisionOptions): Promise<ProvisionedPwa>;

  /**
   * Prepares the profile and launches the standalone PWA instance.
   */
  provisionAndLaunch(url: string, options: ProvisionOptions & { port: number }): Promise<ProvisionResult>;
}

/**
 * Default implementation of PwaProvisioner.
 * Uses appSlugFromUrl, ensureStandaloneProfile, AppIconService, and AppShortcutService by composition.
 */
export class DefaultPwaProvisioner implements PwaProvisioner {
  private readonly launchFn: typeof launchStandaloneApp;
  private readonly iconService: AppIconService;
  private readonly shortcutService: AppShortcutService;
  private readonly registry?: AppRegistry;
  private readonly env: Env;

  constructor(
    options: {
      launchFn?: typeof launchStandaloneApp;
      iconService?: AppIconService;
      shortcutService?: AppShortcutService;
      registry?: AppRegistry;
      env?: Env;
    } = {},
  ) {
    this.launchFn = options.launchFn ?? launchStandaloneApp;
    this.iconService = options.iconService ?? new DefaultAppIconService();
    this.shortcutService = options.shortcutService ?? new WindowsShortcutService();
    this.registry = options.registry;
    this.env = options.env ?? process.env;
  }

  resolveSlug(url: string): string | Promise<string> {
    if (this.registry) {
      return this.registry.resolveSlug(url);
    }
    return appSlugFromUrl(url);
  }

  async provision(url: string, options: ProvisionOptions = {}): Promise<ProvisionedPwa> {
    const appSlug = await this.resolveSlug(url);
    const profileDir = await ensureStandaloneProfile(appSlug, { cacheDir: options.cacheDir });

    // Resolve app directory (parent of profile) to persist icon.ico
    const appDir = join(profileDir, "..");
    const iconPathTarget = join(appDir, "icon.ico");

    let iconPath: string | null = null;
    let shortcutPath: string | null = null;

    try {
      iconPath = await this.iconService.resolveIcon(url, iconPathTarget);
      if (iconPath) {
        const platform = process.platform;
        const targetBinary = resolveFirefoxBinary(platform, this.env);
        const args = buildStandaloneLaunchArgs({ profileDir, port: options.port ?? 9222, url });

        shortcutPath = await this.shortcutService.createShortcut({
          name: appSlug,
          targetBinary,
          args,
          iconPath,
          workingDir: profileDir,
          destinationDir: appDir,
        });
      }
    } catch {
      // Icon and shortcut generation are non-blocking to preserve resilience
    }

    let cookiesSeeded = 0;
    try {
      const sourceProfile = locateDefaultFirefoxProfile();
      if (sourceProfile && sourceProfile !== profileDir) {
        const extractor = new FirefoxCookieExtractor();
        const cookies = await extractor.extractCookies({
          profileDir: sourceProfile,
          targetDomains: [url],
        });
        if (cookies.length > 0) {
          const syncService = new CookieSyncService();
          cookiesSeeded = await syncService.seedProfileDatabase(profileDir, cookies);
        }
      }
    } catch {
      // Cookie seeding is best-effort and non-blocking
    }

    return {
      url,
      appSlug,
      profileDir,
      iconPath,
      shortcutPath,
      cookiesSeeded,
    };
  }

  async provisionAndLaunch(
    url: string,
    options: ProvisionOptions & { port: number },
  ): Promise<ProvisionResult> {
    const provisioned = await this.provision(url, options);
    const launchResult = await this.launchFn({
      url,
      appSlug: provisioned.appSlug,
      port: options.port,
      cacheDir: options.cacheDir,
      ...options.launchOptions,
    });
    return {
      ...provisioned,
      launchResult,
    };
  }
}
