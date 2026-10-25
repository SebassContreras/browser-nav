// Discover tool (spec 011 D4): history-assisted route discovery engine.
// Discovers unmapped routes from Places history (places.sqlite) without launching the browser or BiDi.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveAppTarget } from "../backend/backend.js";
import { readProfileHistory } from "../browser/history-reader.js";
import { resolveStandaloneProfileDir } from "../browser/standalone-profile.js";
import { PwaNavError } from "../core/errors.js";
import { resolveAgentDir, resolveScreensDir } from "../core/storage.js";
import { applyDiscovery, discoverRoutes, type DiscoveredRouteCandidate } from "../screens/screen-discover.js";
import { loadExplicitMap, loadScreenMapsFromDir, selectMap } from "../screens/screen-match.js";
import { writeScreenMap } from "../screens/screen-store.js";
import type { ScreenMap } from "../screens/screen-map.js";
import type { ToolOutcome } from "./types.js";

export interface DiscoverArgs {
  app?: string;
  write?: boolean;
  limit?: number;
  screensDir?: string;
  screenMap?: string;
}

export interface DiscoverOptions {
  cacheDir?: string;
}

export interface DiscoverResult {
  app: string;
  origin: string;
  candidates: DiscoveredRouteCandidate[];
  written: boolean;
  mapPath?: string;
}

export async function discoverTool(
  args: DiscoverArgs,
  options: DiscoverOptions = {},
): Promise<ToolOutcome> {
  if (args.app === undefined || args.app === "") {
    throw new PwaNavError("invalid_args", "discover needs an app name or URL", {
      hint: "browser-nav screens discover <app> (or MCP: browser_discover({ app: \"<app>\" }))",
    });
  }

  const target = resolveAppTarget(args.app);
  const cacheDir = options.cacheDir ?? resolveAgentDir();
  const profileDir = resolveStandaloneProfileDir(target.slug, cacheDir);

  // 1. Locate the screen map for this app
  let mapPath: string | undefined;
  let map: ScreenMap;

  if (args.screenMap) {
    mapPath = args.screenMap;
    map = await loadExplicitMap(mapPath);
  } else {
    // Check canonical app screens path first: <agentDir>/apps/<slug>/screens.json
    const appScreensJson = join(cacheDir, "apps", target.slug, "screens.json");
    if (existsSync(appScreensJson)) {
      mapPath = appScreensJson;
      map = await loadExplicitMap(mapPath);
    } else {
      const screensDir = args.screensDir ?? resolveScreensDir({ cacheDir });
      const loadedMaps = await loadScreenMapsFromDir(screensDir, { agentDir: cacheDir });
      try {
        const selected = selectMap(loadedMaps, `https://${target.host}`);
        map = selected;
        const found = loadedMaps.find((l) => l.map === selected);
        mapPath = found?.path;
      } catch (err) {
        if (err instanceof PwaNavError && err.code === "unmapped_screen") {
          throw new PwaNavError(
            "unmapped_screen",
            `no screen map found for ${target.slug} (${target.host})`,
            {
              hint: `learn the first screen first with 'browser-nav snapshot --learn' or place screens.json in ${appScreensJson}`,
            },
          );
        }
        throw err;
      }
    }
  }

  // 2. Read history from places.sqlite
  const entries = await readProfileHistory(profileDir, `https://${target.host}`);
  if (!entries || entries.length === 0) {
    return {
      text: `discover: no history found for ${target.slug} (0 visited URLs). Browse the app first or use snapshot --learn.`,
      structured: {
        app: target.slug,
        origin: `https://${target.host}`,
        candidates: [],
        written: false,
        mapPath,
      },
    };
  }

  // 3. Discover candidates
  const candidates = discoverRoutes(entries, map, { limit: args.limit });
  if (candidates.length === 0) {
    return {
      text: `discover: all visited history routes are already mapped or in unmapped[] for ${target.slug}.`,
      structured: {
        app: target.slug,
        origin: `https://${target.host}`,
        candidates: [],
        written: false,
        mapPath,
      },
    };
  }

  // 4. Apply discovery if write is enabled
  let written = false;
  if (args.write === true && mapPath) {
    const updatedMap = applyDiscovery(map, candidates);
    await writeScreenMap(mapPath, updatedMap);
    written = true;
  }

  const lines = candidates.map((c) => {
    const dateStr =
      c.lastVisitDate > 0
        ? new Date(Math.floor(c.lastVisitDate / 1000)).toISOString().replace("T", " ").replace(/\..+/, "")
        : "unknown";
    const titleSnippet = c.lastTitle ? ` "${c.lastTitle}"` : "";
    return `  ${c.route} (${String(c.visitCount)} visits, last ${dateStr}${titleSnippet})`;
  });

  const header = written
    ? `discover: wrote ${String(candidates.length)} candidate route(s) into unmapped[] in ${mapPath ?? ""}:\n`
    : `discover: found ${String(candidates.length)} candidate route(s) (dry-run, pass --write to persist to unmapped[]):\n`;

  return {
    text: `${header}${lines.join("\n")}`,
    structured: {
      app: target.slug,
      origin: `https://${target.host}`,
      candidates,
      written,
      mapPath,
    },
  };
}
