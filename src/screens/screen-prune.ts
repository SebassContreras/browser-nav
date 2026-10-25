import { copyFile } from "node:fs/promises";
import { PwaNavError } from "../core/errors.js";
import { isDynamicContentLink, isDynamicListItemAction, isStructuralControl } from "./screen-learn.js";
import {
  crossCheck,
  fingerprintOf,
  loadScreenMap,
  screenElements,
  type Screen,
  type ScreenMap,
} from "./screen-map.js";
import { writeScreenMap } from "./screen-store.js";
import { resolveScreensDir } from "./screen-match.js";

export interface PruneResult {
  appSlug: string;
  screensPruned: number;
  actionsRemoved: number;
  linksRemoved: number;
  backupPath: string;
  outputPath: string;
}

export function pruneScreenNoise(screen: Screen): {
  prunedScreen: Screen;
  actionsRemoved: number;
  linksRemoved: number;
} {
  const originalActionCount = screen.actions.length;
  const originalLinkCount = screen.links.length;

  // Filter actions that are dynamic card items or dismiss buttons
  const actions = screen.actions.filter((a) => {
    // If it's a structural control, preserve it
    if (isStructuralControl({ role: a.role, name: a.name })) {
      return true;
    }
    // If it's an item-level dynamic card action, prune it
    if (isDynamicListItemAction({ role: a.role, name: a.name, containerRole: a.container })) {
      return false;
    }
    return true;
  });

  // Filter links that are transient content stories or articles
  const links = screen.links.filter((l) => {
    if (isDynamicContentLink({ href: l.href })) {
      return false;
    }
    return true;
  });

  const prunedScreen: Screen = {
    ...screen,
    actions,
    links,
  };

  prunedScreen.fingerprint = fingerprintOf(screenElements(prunedScreen));

  return {
    prunedScreen,
    actionsRemoved: originalActionCount - actions.length,
    linksRemoved: originalLinkCount - links.length,
  };
}

export async function pruneAppScreenMap(
  appSlug: string,
  options: { screensDir?: string; cacheDir?: string } = {},
): Promise<PruneResult> {
  const dir = resolveScreensDir({ screensDir: options.screensDir, cacheDir: options.cacheDir });
  const mapPath = `${dir}/${appSlug}.screens.json`;

  let map: ScreenMap;
  try {
    map = await loadScreenMap(mapPath);
  } catch (err) {
    throw new PwaNavError("invalid_args", `cannot load screen map for ${appSlug} at ${mapPath}: ${String(err)}`);
  }

  const backupPath = `${mapPath}.bak`;
  await copyFile(mapPath, backupPath);

  let totalActionsRemoved = 0;
  let totalLinksRemoved = 0;
  let screensPrunedCount = 0;

  const prunedScreens: Screen[] = [];
  for (const screen of map.screens) {
    const { prunedScreen, actionsRemoved, linksRemoved } = pruneScreenNoise(screen);
    prunedScreens.push(prunedScreen);
    if (actionsRemoved > 0 || linksRemoved > 0) {
      screensPrunedCount += 1;
      totalActionsRemoved += actionsRemoved;
      totalLinksRemoved += linksRemoved;
    }
  }

  const updatedMap: ScreenMap = {
    ...map,
    screens: prunedScreens,
  };

  // Cross-check to verify fingerprint and relationship integrity
  crossCheck(updatedMap);

  await writeScreenMap(mapPath, updatedMap);

  return {
    appSlug,
    screensPruned: screensPrunedCount,
    actionsRemoved: totalActionsRemoved,
    linksRemoved: totalLinksRemoved,
    backupPath,
    outputPath: mapPath,
  };
}
