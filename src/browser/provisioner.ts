import { join } from "node:path";
import { appSlugFromUrl } from "../backend/backend.js";
import { ensureStandaloneProfile } from "./standalone-profile.js";
import {
  firefoxPwaDir,
  runtimePath,
} from "./pwa-runtime.js";
import {
  launchStandaloneApp,
  type StandaloneLaunchOptions,
  type StandaloneLaunchResult,
} from "./standalone-runner.js";
import { type AppIconService, DefaultAppIconService } from "./app-icon.js";
import { type AppShortcutService, WindowsShortcutService } from "./app-shortcut.js";

/**
 * Domain specification and runtime configuration for an isolated standalone PWA.
 */
export interface ProvisionedPwa {
  url: string;
  appSlug: string;
  profileDir: string;
  iconPath?: string | null;
  shortcutPath?: string | null;
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
  resolveSlug(url: string): string;

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

  constructor(
    options: {
      launchFn?: typeof launchStandaloneApp;
      iconService?: AppIconService;
      shortcutService?: AppShortcutService;
    } = {},
  ) {
    this.launchFn = options.launchFn ?? launchStandaloneApp;
    this.iconService = options.iconService ?? new DefaultAppIconService();
    this.shortcutService = options.shortcutService ?? new WindowsShortcutService();
  }

  resolveSlug(url: string): string {
    return appSlugFromUrl(url);
  }

  async provision(url: string, options: ProvisionOptions = {}): Promise<ProvisionedPwa> {
    const appSlug = this.resolveSlug(url);
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
        const dir = firefoxPwaDir(platform, process.env);
        const targetBinary = runtimePath(dir, platform);
        const port = options.port ?? 9222;

        const args = [
          "--profile",
          profileDir,
          "--pwa",
          appSlug,
          "--remote-debugging-port",
          String(port),
          url,
        ];

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

    return {
      url,
      appSlug,
      profileDir,
      iconPath,
      shortcutPath,
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
