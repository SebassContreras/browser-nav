import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveAgentDir } from "../core/storage.js";
import { PERFORMANCE_PREFS } from "./performance-prefs.js";
import { mergeUserJs, type PrefValue } from "./user-js.js";

export { serializeUserJs, type PrefValue } from "./user-js.js";

export const DEFAULT_STANDALONE_USER_PREFS: Readonly<Record<string, PrefValue>> = {
  // WebDriver BiDi activation
  "remote.active-protocols": 1,
  "remote.experimental-modules": 1,
  // Disable first-run / onboarding noise and telemetry
  "browser.shell.checkDefaultBrowser": false,
  "datareporting.policy.dataSubmissionEnabled": false,
  "datareporting.healthreport.uploadEnabled": false,
  "toolkit.telemetry.unified": false,
  "toolkit.telemetry.enabled": false,
  // Enable userChrome.css customizations for standalone window chrome
  "toolkit.legacyUserProfileCustomizations.stylesheets": true,
  // Restore native OS window titlebar (disables CSD to preserve native min/max/close controls and window dragging)
  "browser.tabs.inTitlebar": 0,
  // Windows: group each profile under its own taskbar entry instead of regular Firefox
  "taskbar.grouping.useprofile": true,
};

export const BIDI_UNOVERRIDABLE_PREF_KEYS: ReadonlySet<string> = new Set([
  "remote.active-protocols",
  "remote.experimental-modules",
]);

export const STANDALONE_USER_CHROME_CSS = `/* Hide Firefox tabs toolbar and navigation/URL bar for clean standalone app window with native OS titlebar */
#TabsToolbar {
  visibility: collapse !important;
}
#nav-bar {
  visibility: collapse !important;
}
`;

export function resolveStandaloneProfileDir(appSlug: string, cacheDir?: string): string {
  const agentDir = resolveAgentDir({ cacheDir });
  return join(agentDir, "apps", appSlug, "profile");
}

export async function ensureStandaloneProfile(
  appSlug: string,
  options: {
    cacheDir?: string;
    extraPrefs?: Record<string, PrefValue>;
  } = {},
): Promise<string> {
  const profileDir = resolveStandaloneProfileDir(appSlug, options.cacheDir);
  const chromeDir = join(profileDir, "chrome");
  await mkdir(chromeDir, { recursive: true });

  const managedPrefs: Record<string, PrefValue> = {
    ...DEFAULT_STANDALONE_USER_PREFS,
    ...PERFORMANCE_PREFS,
    ...(options.extraPrefs ?? {}),
  };

  const userJsPath = join(profileDir, "user.js");
  let existingContent = "";
  try {
    existingContent = await readFile(userJsPath, "utf8");
  } catch {
    existingContent = "";
  }

  const updatedUserJs = mergeUserJs(existingContent, managedPrefs, {
    unoverridableKeys: BIDI_UNOVERRIDABLE_PREF_KEYS,
  });

  if (updatedUserJs !== existingContent) {
    await writeFile(userJsPath, updatedUserJs, "utf8");
  }

  const chromeCssPath = join(chromeDir, "userChrome.css");
  let existingCss = "";
  try {
    existingCss = await readFile(chromeCssPath, "utf8");
  } catch {
    existingCss = "";
  }
  if (existingCss !== STANDALONE_USER_CHROME_CSS) {
    await writeFile(chromeCssPath, STANDALONE_USER_CHROME_CSS, "utf8");
  }

  return profileDir;
}
