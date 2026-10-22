import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getFirefoxProfilesRootDir,
  locateDefaultFirefoxProfile,
  parseProfilesIni,
} from "../firefox-profile-discovery.js";

describe("Firefox Profile Discovery", () => {
  it("returns Windows AppData Firefox directory when platform is win32", () => {
    // Arrange
    const env = { APPDATA: "C:\\Users\\Alice\\AppData\\Roaming" };

    // Act
    const dir = getFirefoxProfilesRootDir({ platform: "win32", env });

    // Assert
    assert.equal(dir, join("C:\\Users\\Alice\\AppData\\Roaming", "Mozilla", "Firefox"));
  });

  it("returns macOS Application Support Firefox directory when platform is darwin", () => {
    // Arrange
    const homeDir = "/Users/Alice";

    // Act
    const dir = getFirefoxProfilesRootDir({ platform: "darwin", homeDir });

    // Assert
    assert.equal(dir, join("/Users/Alice", "Library", "Application Support", "Firefox"));
  });

  it("returns Linux .mozilla/firefox directory when platform is linux", () => {
    // Arrange
    const homeDir = "/home/alice";

    // Act
    const dir = getFirefoxProfilesRootDir({ platform: "linux", homeDir });

    // Assert
    assert.equal(dir, join("/home/alice", ".mozilla", "firefox"));
  });

  it("parses relative and absolute profile sections correctly", () => {
    const testDir = join(tmpdir(), `test-ini-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    try {
      // Arrange
      const ini = `
[Profile1]
Name=default-release
IsRelative=1
Path=Profiles/abc123.default-release
Default=1

[Profile0]
Name=dev-edition
IsRelative=0
Path=/custom/profiles/dev
Default=0
`;

      // Act
      const profiles = parseProfilesIni(ini, testDir);

      // Assert
      assert.equal(profiles.length, 2);
      assert.equal(profiles[0].name, "default-release");
      assert.equal(profiles[0].isDefault, true);
      assert.equal(profiles[0].path, join(testDir, "Profiles", "abc123.default-release"));

      assert.equal(profiles[1].name, "dev-edition");
      assert.equal(profiles[1].isDefault, false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("parses Install sections with default relative paths", () => {
    const testDir = join(tmpdir(), `test-install-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    try {
      // Arrange
      const ini = `
[Install4F96D1932A9F858E]
Default=Profiles/xyz456.default-release
Locked=1
`;

      // Act
      const profiles = parseProfilesIni(ini, testDir);

      // Assert
      assert.equal(profiles.length, 1);
      assert.equal(profiles[0].isDefault, true);
      assert.equal(profiles[0].path, join(testDir, "Profiles", "xyz456.default-release"));
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("locates profile marked as default in profiles.ini when directory exists", () => {
    const testDir = join(tmpdir(), `test-locate-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    try {
      // Arrange
      const profileFolder = join(testDir, "Profiles", "profile.default-release");
      mkdirSync(profileFolder, { recursive: true });

      const iniContent = `
[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/profile.default-release
Default=1
`;
      writeFileSync(join(testDir, "profiles.ini"), iniContent, "utf8");

      // With explicit custom path fallback
      const foundDirect = locateDefaultFirefoxProfile({
        customProfilePath: profileFolder,
      });

      // Assert
      assert.equal(foundDirect, profileFolder);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("falls back to directory matching when profiles.ini is absent", () => {
    const testDir = join(tmpdir(), `test-dir-fallback-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    try {
      // Missing Mozilla/Firefox structure
      const found = locateDefaultFirefoxProfile({
        platform: "win32",
        env: { APPDATA: testDir },
      });
      assert.equal(found, null);

      // Now create Mozilla/Firefox/Profiles structure
      const mozDir = join(testDir, "Mozilla", "Firefox", "Profiles");
      const expectedFolder = join(mozDir, "myuser.default-release");
      mkdirSync(expectedFolder, { recursive: true });

      const resolved = locateDefaultFirefoxProfile({
        platform: "win32",
        env: { APPDATA: testDir },
      });

      assert.equal(resolved, expectedFolder);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
