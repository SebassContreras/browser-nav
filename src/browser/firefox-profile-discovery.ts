import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export interface FirefoxProfileInfo {
  name: string;
  path: string;
  isDefault: boolean;
  relativePath?: string;
}

export interface ProfileDiscoveryOptions {
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  homeDir?: string;
  customProfilePath?: string;
}

/**
 * Returns candidate root directories where Firefox profiles are located per OS.
 */
export function getFirefoxProfilesRootDir(options: ProfileDiscoveryOptions = {}): string | null {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const home = options.homeDir ?? homedir();

  if (platform === "win32") {
    const appData = env.APPDATA;
    if (appData) {
      return join(appData, "Mozilla", "Firefox");
    }
    return join(home, "AppData", "Roaming", "Mozilla", "Firefox");
  }

  if (platform === "darwin") {
    return join(home, "Library", "Application Support", "Firefox");
  }

  // Linux and other Unixes
  return join(home, ".mozilla", "firefox");
}

/**
 * Parses Firefox `profiles.ini` content into profile records.
 */
export function parseProfilesIni(content: string, baseDir: string): FirefoxProfileInfo[] {
  const profiles: FirefoxProfileInfo[] = [];
  const lines = content.split(/\r?\n/);

  let currentSection = "";
  let currentProfile: Partial<FirefoxProfileInfo> & { isRelative?: boolean } = {};

  const saveCurrent = () => {
    if (currentProfile.name && currentProfile.path) {
      const resolvedPath = currentProfile.isRelative
        ? resolve(baseDir, currentProfile.path)
        : resolve(currentProfile.path);

      profiles.push({
        name: currentProfile.name,
        path: resolvedPath,
        isDefault: Boolean(currentProfile.isDefault),
        relativePath: currentProfile.relativePath,
      });
    }
    currentProfile = {};
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      saveCurrent();
      currentSection = line.slice(1, -1).trim();
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    const val = line.slice(equalIndex + 1).trim();

    if (currentSection.startsWith("Profile") || currentSection.startsWith("Install")) {
      if (key === "Name") {
        currentProfile.name = val;
      } else if (key === "Path") {
        currentProfile.path = val;
        currentProfile.relativePath = val;
      } else if (key === "IsRelative") {
        currentProfile.isRelative = val === "1";
      } else if (key === "Default") {
        if (val === "1") {
          currentProfile.isDefault = true;
        } else if (!currentProfile.path) {
          // In [Install*] sections, Default=<relativePath>
          currentProfile.path = val;
          currentProfile.isRelative = !isAbsolute(val);
          currentProfile.isDefault = true;
          if (!currentProfile.name) {
            currentProfile.name = `Install-${val}`;
          }
        }
      }
    }
  }

  saveCurrent();
  return profiles;
}

/**
 * Discovers and returns the default Firefox profile directory path, or null if not found.
 */
export function locateDefaultFirefoxProfile(options: ProfileDiscoveryOptions = {}): string | null {
  if (options.customProfilePath) {
    const custom = resolve(options.customProfilePath);
    if (existsSync(custom)) {
      return custom;
    }
  }

  const baseDir = getFirefoxProfilesRootDir(options);
  if (!baseDir || !existsSync(baseDir)) {
    return null;
  }

  const iniPath = join(baseDir, "profiles.ini");
  if (existsSync(iniPath)) {
    try {
      const content = readFileSync(iniPath, "utf8");
      const profiles = parseProfilesIni(content, baseDir);

      // Priority 1: explicitly marked isDefault and path exists
      const defaultProfile = profiles.find((p) => p.isDefault && existsSync(p.path));
      if (defaultProfile) {
        return defaultProfile.path;
      }

      // Priority 2: release profile name (e.g. contains default-release)
      const releaseProfile = profiles.find(
        (p) => (p.name.includes("default-release") || p.path.includes("default-release")) && existsSync(p.path),
      );
      if (releaseProfile) {
        return releaseProfile.path;
      }

      // Priority 3: any profile marked with default in its name
      const anyDefault = profiles.find((p) => p.name.toLowerCase().includes("default") && existsSync(p.path));
      if (anyDefault) {
        return anyDefault.path;
      }

      // Priority 4: first valid profile in profiles.ini
      const firstValid = profiles.find((p) => existsSync(p.path));
      if (firstValid) {
        return firstValid.path;
      }
    } catch {
      // Fall through to directory heuristic
    }
  }

  // Fallback heuristic: search Profiles subdirectory directly
  const profilesSubdir = join(baseDir, "Profiles");
  const searchDir = existsSync(profilesSubdir) ? profilesSubdir : baseDir;

  try {
    const entries = readdirSync(searchDir, { withFileTypes: true });
    const dirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    // Prefer *.default-release or *.default
    const releaseMatch = dirNames.find((n) => n.includes(".default-release"));
    if (releaseMatch) {
      return join(searchDir, releaseMatch);
    }

    const defaultMatch = dirNames.find((n) => n.includes(".default"));
    if (defaultMatch) {
      return join(searchDir, defaultMatch);
    }
  } catch {
    return null;
  }

  return null;
}
