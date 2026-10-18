import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ShortcutOptions } from "../app-shortcut.js";
import { DefaultPwaProvisioner } from "../provisioner.js";
import type { StandaloneLaunchOptions, StandaloneLaunchResult } from "../standalone-runner.js";

describe("DefaultPwaProvisioner - profile and slug", () => {
  it("resolves slug deterministically from arbitrary URLs", () => {
    const provisioner = new DefaultPwaProvisioner();
    assert.equal(provisioner.resolveSlug("https://github.com/trending"), "github-com");
    assert.equal(provisioner.resolveSlug("https://news.ycombinator.com/item?id=1"), "news-ycombinator-com");
    assert.equal(provisioner.resolveSlug("http://127.0.0.1:8080/dashboard"), "127-0-0-1");
  });

  it("creates dedicated profile directory with BiDi user.js and custom styles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pwa-provision-test-"));
    try {
      const provisioner = new DefaultPwaProvisioner();
      const targetUrl = "https://app.slack.com/client";
      const result = await provisioner.provision(targetUrl, { cacheDir: dir });

      assert.equal(result.url, targetUrl);
      assert.equal(result.appSlug, "app-slack-com");
      assert.equal(result.profileDir, join(dir, "apps", "app-slack-com", "profile"));
      assert.ok(existsSync(result.profileDir));

      const userJsPath = join(result.profileDir, "user.js");
      assert.ok(existsSync(userJsPath));
      const userJs = await readFile(userJsPath, "utf8");
      assert.match(userJs, /remote\.active-protocols/);
      assert.match(userJs, /toolkit\.legacyUserProfileCustomizations\.stylesheets/);

      const userChromePath = join(result.profileDir, "chrome", "userChrome.css");
      assert.ok(existsSync(userChromePath));
      const userChrome = await readFile(userChromePath, "utf8");
      assert.match(userChrome, /#TabsToolbar/);
      assert.match(userChrome, /#nav-bar/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("provisions and delegates launch with port, profile, and appSlug", async () => {
    let capturedOptions: unknown;
    const mockLaunch = (opts: StandaloneLaunchOptions): Promise<StandaloneLaunchResult> => {
      capturedOptions = opts;
      return Promise.resolve({
        appSlug: "example-com",
        url: "https://example.com/app",
        port: 9222,
        profileDir: "/fake/dir",
        command: "mock-cmd",
        pid: 1234,
      });
    };

    const provisioner = new DefaultPwaProvisioner({ launchFn: mockLaunch });
    const res = await provisioner.provisionAndLaunch("https://example.com/app", {
      port: 9222,
      cacheDir: "test-cache",
    });

    assert.equal(res.appSlug, "example-com");
    assert.equal(res.launchResult?.pid, 1234);
    assert.deepEqual(capturedOptions, {
      url: "https://example.com/app",
      appSlug: "example-com",
      port: 9222,
      cacheDir: "test-cache",
    });
  });

  it("triggers icon resolution and shortcut creation during provisioning", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pwa-provision-icon-"));
    try {
      let iconTarget: string | null = null;
      let shortcutOpts: ShortcutOptions | undefined;

      const mockIconService = {
        resolveIcon: async (_url: string, targetPath: string) => {
          await Promise.resolve();
          iconTarget = targetPath;
          return targetPath;
        },
      };

      const mockShortcutService = {
        createShortcut: async (options: ShortcutOptions) => {
          await Promise.resolve();
          shortcutOpts = options;
          return `${options.destinationDir}/${options.name}.lnk`;
        },
      };

      const provisioner = new DefaultPwaProvisioner({
        iconService: mockIconService,
        shortcutService: mockShortcutService,
        env: { PWA_NAV_FIREFOX_BINARY: "/x/firefox" },
      });

      const res = await provisioner.provision("https://linkedin.com", { cacheDir: dir });
      assert.equal(res.appSlug, "linkedin-com");
      assert.ok(iconTarget);
      assert.match(iconTarget, /icon\.ico$/);
      assert.equal(res.iconPath, iconTarget);
      assert.ok(shortcutOpts);
      assert.equal(shortcutOpts.name, "linkedin-com");
      assert.ok(res.shortcutPath);
      assert.match(res.shortcutPath, /linkedin-com\.lnk$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
