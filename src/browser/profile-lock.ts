import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import path from "node:path";
import {
  createProcessInspector,
  type ProcessInfo,
  type ProcessInspector,
} from "./process-inspector.js";

export type ProfileLockState = "free" | "held" | "stale";

export interface ProfileLockResult {
  state: ProfileLockState;
  holders: ProcessInfo[];
}

export interface FsDeps {
  stat(path: string): Promise<unknown>;
  readlink(path: string): Promise<string>;
  unlink(path: string): Promise<void>;
  tryOpenExclusive(path: string): boolean; // returns true if file can be opened for writing without error
}

export const defaultFsDeps: FsDeps = {
  stat: (p: string) => fs.stat(p),
  readlink: (p: string) => fs.readlink(p),
  unlink: (p: string) => fs.unlink(p),
  tryOpenExclusive: (p: string): boolean => {
    try {
      // In Windows, Firefox parent.lock is locked exclusively with sharing denied.
      // Opening with "r+" fails with EBUSY or EPERM if held.
      const fd = openSync(p, "r+");
      closeSync(fd);
      return true;
    } catch {
      return false;
    }
  },
};

export interface ProfileLockDeps {
  platform?: NodeJS.Platform;
  fs?: FsDeps;
  inspector?: ProcessInspector;
}

export async function inspectProfileLock(
  profileDir: string,
  deps: ProfileLockDeps = {},
): Promise<ProfileLockResult> {
  const platform = deps.platform ?? process.platform;
  const fileSystem = deps.fs ?? defaultFsDeps;
  const inspector = deps.inspector ?? createProcessInspector(platform);
  const pathModule = platform === "win32" ? path.win32 : path.posix;

  const parentLockWin = pathModule.join(profileDir, "parent.lock");
  const parentLockPosix = pathModule.join(profileDir, ".parentlock");
  const lockSymlinkPosix = pathModule.join(profileDir, "lock");

  let definitelyHeld = false;
  let posixSymlinkPid: number | undefined;

  if (platform === "win32") {
    let exists = false;
    try {
      await fileSystem.stat(parentLockWin);
      exists = true;
    } catch {
      exists = false;
    }

    if (!exists) {
      return { state: "free", holders: [] };
    }

    const canOpen = fileSystem.tryOpenExclusive(parentLockWin);
    if (!canOpen) {
      definitelyHeld = true;
    }
  } else {
    // POSIX
    let dotParentLockExists = false;
    try {
      await fileSystem.stat(parentLockPosix);
      dotParentLockExists = true;
    } catch {
      dotParentLockExists = false;
    }

    let symlinkTarget: string | undefined;
    try {
      symlinkTarget = await fileSystem.readlink(lockSymlinkPosix);
    } catch {
      symlinkTarget = undefined;
    }

    if (!dotParentLockExists && symlinkTarget === undefined) {
      return { state: "free", holders: [] };
    }

    if (symlinkTarget !== undefined) {
      // Firefox symlink format: <ip>:+<pid> e.g. 127.0.0.1:+1234 or :+1234
      const parts = symlinkTarget.split(":+");
      const pidStr = parts[parts.length - 1];
      if (pidStr !== undefined) {
        const parsedPid = parseInt(pidStr, 10);
        if (Number.isInteger(parsedPid) && parsedPid > 0) {
          posixSymlinkPid = parsedPid;
          if (inspector.isAlive(parsedPid)) {
            definitelyHeld = true;
          }
        }
      }
    }
  }

  // If artifacts exist, find candidate holders whose command line contains profileDir
  const holders = await inspector.findByArg(profileDir);

  if (holders.length > 0) {
    return { state: "held", holders };
  }

  // If posixSymlinkPid is alive, check if it's PID reuse (command doesn't match profileDir)
  if (posixSymlinkPid !== undefined && inspector.isAlive(posixSymlinkPid)) {
    // In design D2: PID reuse -> a dead Firefox PID now belongs to another program;
    // a PID only counts as a holder if its command line contains the profile path.
    // Since findByArg found no holder with profileDir, this is stale.
    return { state: "stale", holders: [] };
  }

  // If Windows OS handle says definitely held (canOpen == false)
  if (definitelyHeld) {
    return { state: "held", holders: [] };
  }

  // Artifact found, but no live process holds it
  return { state: "stale", holders: [] };
}

export async function clearStaleLock(
  profileDir: string,
  deps: ProfileLockDeps = {},
): Promise<string[]> {
  const platform = deps.platform ?? process.platform;
  const fileSystem = deps.fs ?? defaultFsDeps;
  const pathModule = platform === "win32" ? path.win32 : path.posix;

  // Re-inspect immediately before deleting to prevent race conditions
  const inspectResult = await inspectProfileLock(profileDir, deps);
  if (inspectResult.state !== "stale") {
    return [];
  }

  const removed: string[] = [];

  if (platform === "win32") {
    const parentLockWin = pathModule.join(profileDir, "parent.lock");
    // Verify it opens cleanly before unlinking
    if (fileSystem.tryOpenExclusive(parentLockWin)) {
      try {
        await fileSystem.unlink(parentLockWin);
        removed.push(parentLockWin);
      } catch {
        // Ignored if unable to unlink
      }
    }
  } else {
    // POSIX: remove lock symlink if present; .parentlock (fcntl) is never touched
    const lockSymlinkPosix = pathModule.join(profileDir, "lock");
    try {
      await fileSystem.unlink(lockSymlinkPosix);
      removed.push(lockSymlinkPosix);
    } catch {
      // Ignored
    }
  }

  return removed;
}
