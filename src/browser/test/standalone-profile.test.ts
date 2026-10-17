import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  ensureStandaloneProfile,
  serializeUserJs,
} from "../standalone-profile.js";

test("serializeUserJs formats preferences as valid user_pref lines", () => {
  const content = serializeUserJs({
    "remote.active-protocols": 1,
    "browser.test": true,
    "custom.str": "value",
  });
  assert.match(content, /user_pref\("remote\.active-protocols", 1\);/);
  assert.match(content, /user_pref\("browser\.test", true\);/);
  assert.match(content, /user_pref\("custom\.str", "value"\);/);
});

test("ensureStandaloneProfile creates profile directory with seeded user.js containing BiDi flags and performance prefs", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pwa-nav-standalone-profile-"));
  try {
    const profileDir = await ensureStandaloneProfile("linkedin", { cacheDir: tempDir });
    assert.equal(profileDir, join(tempDir, "apps", "linkedin", "profile"));

    const userJs = await readFile(join(profileDir, "user.js"), "utf8");
    assert.match(userJs, /\/\/ BEGIN pwa-nav managed/);
    assert.match(userJs, /user_pref\("remote\.active-protocols", 1\);/);
    assert.match(userJs, /user_pref\("remote\.experimental-modules", 1\);/);
    assert.match(userJs, /user_pref\("browser\.shell\.checkDefaultBrowser", false\);/);
    assert.match(userJs, /user_pref\("general\.smoothScroll", false\);/);
    assert.match(userJs, /user_pref\("ui\.prefersReducedMotion", 1\);/);
    assert.match(userJs, /user_pref\("network\.dns\.disablePrefetch", true\);/);
    assert.match(userJs, /user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets", true\);/);
    assert.match(userJs, /user_pref\("browser\.tabs\.inTitlebar", 0\);/);
    assert.match(userJs, /user_pref\("taskbar\.grouping\.useprofile", true\);/);
    assert.match(userJs, /\/\/ END pwa-nav managed/);

    const userChrome = await readFile(join(profileDir, "chrome", "userChrome.css"), "utf8");
    assert.match(userChrome, /#TabsToolbar/);
    assert.match(userChrome, /#nav-bar/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("ensureStandaloneProfile supports extraPrefs overrides without mutating defaults", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pwa-nav-standalone-extra-"));
  try {
    const profileDir = await ensureStandaloneProfile("linkedin", {
      cacheDir: tempDir,
      extraPrefs: { "custom.flag": 42 },
    });
    const userJs = await readFile(join(profileDir, "user.js"), "utf8");
    assert.match(userJs, /user_pref\("custom\.flag", 42\);/);
    assert.match(userJs, /user_pref\("remote\.active-protocols", 1\);/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("ensureStandaloneProfile preserves user overrides non-destructively on relaunch", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pwa-nav-standalone-relaunch-"));
  try {
    const profileDir = await ensureStandaloneProfile("linkedin", { cacheDir: tempDir });
    const userJsPath = join(profileDir, "user.js");

    // Prepend a user custom line
    const original = await readFile(userJsPath, "utf8");
    await writeFile(
      userJsPath,
      `user_pref("general.smoothScroll", true);\n${original}`,
      "utf8",
    );

    // Re-run ensureStandaloneProfile
    await ensureStandaloneProfile("linkedin", { cacheDir: tempDir });
    const reloaded = await readFile(userJsPath, "utf8");

    // The user's override stays at the top
    assert.ok(reloaded.startsWith(`user_pref("general.smoothScroll", true);\n`));
    // The managed block does not duplicate smoothScroll
    const block = reloaded.slice(
      reloaded.indexOf("// BEGIN pwa-nav managed"),
      reloaded.indexOf("// END pwa-nav managed"),
    );
    assert.ok(!block.includes("general.smoothScroll"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
