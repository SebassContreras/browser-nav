import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PwaNavError } from '../core/errors.js';
import { resolveAgentDir } from '../core/storage.js';
import { packDir, unpackFile } from './archive.js';
import { inspectProfileLock, type ProfileLockDeps } from './profile-lock.js';
import { resolveStandaloneProfileDir } from './standalone-profile.js';

export interface BackupManifest {
  format: 1;
  app: string;
  createdAt: string;
  firefoxVersion?: string;
}

export interface BackupProfileOptions {
  out?: string;
  cacheDir?: string;
  lockDeps?: ProfileLockDeps;
}

export interface BackupProfileResult {
  archivePath: string;
  manifest: BackupManifest;
}

export interface RestoreProfileOptions {
  force?: boolean;
  cacheDir?: string;
  lockDeps?: ProfileLockDeps;
}

export interface RestoreProfileResult {
  app: string;
  restoredFrom: string;
  previousProfileDir?: string;
  manifest: BackupManifest;
  warning?: string;
}

const VOLATILE_PREFIXES = [
  'cache2/',
  'startupCache/',
  'thumbnails/',
  'jumpListCache/',
  'shader-cache/',
  'crashes/',
  'minidumps/',
  'datareporting/',
  'saved-telemetry-pings/',
  'safebrowsing/',
  'storage/temporary/',
];

const VOLATILE_FILES = new Set(['parent.lock', '.parentlock', 'lock']);

/**
 * Pure check whether a relative path inside a profile directory is volatile cache / lock noise.
 * Expects path normalized with forward slashes or standard separators.
 */
export function isVolatileProfilePath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.?\//, '');
  if (normalized === '' || normalized === '.') {
    return false;
  }

  // Exact file matches or lock files
  const base = path.posix.basename(normalized);
  if (VOLATILE_FILES.has(base)) {
    return true;
  }
  if (base.endsWith('.sqlite-shm')) {
    return true;
  }

  // Directory prefix matches
  for (const prefix of VOLATILE_PREFIXES) {
    if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses compatibility.ini to extract LastVersion if present.
 */
export async function readFirefoxCompatibilityVersion(
  profileDir: string,
): Promise<string | undefined> {
  try {
    const iniPath = path.join(profileDir, 'compatibility.ini');
    const content = await readFile(iniPath, 'utf8');
    const match = content.match(/^LastVersion=(.*)$/m);
    if (match?.[1]) {
      const fullVersion = match[1].trim();
      // fullVersion might be 158.0_20261007201254/20261007201254 or 158.0
      return fullVersion.split('_')[0] ?? fullVersion;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Backs up an isolated PWA profile into a .tar.gz archive.
 */
export async function backupProfile(
  app: string,
  options: BackupProfileOptions = {},
): Promise<BackupProfileResult> {
  const profileDir = resolveStandaloneProfileDir(app, options.cacheDir);

  // Check if profile directory exists
  try {
    await stat(profileDir);
  } catch {
    throw new PwaNavError(
      'invalid_args',
      `Profile directory for app '${app}' does not exist: ${profileDir}`,
      { hint: 'Ensure the app is installed or has been opened before backing up.' },
    );
  }

  // Check lock
  const lockResult = await inspectProfileLock(profileDir, options.lockDeps);
  if (lockResult.state === 'held') {
    throw new PwaNavError(
      'session_busy',
      `Cannot back up profile for app '${app}': profile is currently in use by a running browser instance`,
      { hint: 'Close the PWA application before creating a backup.' },
    );
  }

  const agentDir = resolveAgentDir({ cacheDir: options.cacheDir });
  const backupsDir = path.join(agentDir, 'backups');
  await mkdir(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetArchive =
    options.out !== undefined
      ? path.resolve(options.out)
      : path.join(backupsDir, `${app}-${timestamp}.tar.gz`);

  await mkdir(path.dirname(targetArchive), { recursive: true });

  const firefoxVersion = await readFirefoxCompatibilityVersion(profileDir);
  const manifest: BackupManifest = {
    format: 1,
    app,
    createdAt: new Date().toISOString(),
    ...(firefoxVersion ? { firefoxVersion } : {}),
  };

  // Create staging root containing manifest.json and profile/
  const stagingRoot = path.join(
    backupsDir,
    `.staging-${app}-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(stagingRoot, { recursive: true });

  try {
    await writeFile(
      path.join(stagingRoot, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    // Staging profile directory with non-volatile files
    const stagingProfileDir = path.join(stagingRoot, 'profile');
    await mkdir(stagingProfileDir, { recursive: true });

    // Pack into targetArchive:
    // We pack from stagingRoot, but we want profile/ to come from profileDir while filtering volatile files.
    // To keep it clean and robust, copy allowed files into stagingProfileDir or use packDir with filter
    // Let's copy recursively while filtering:
    async function copyDirFiltered(src: string, dest: string, relBase = ''): Promise<void> {
      const entries = await readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        const entryRel = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (isVolatileProfilePath(entryRel)) {
          continue;
        }
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          await mkdir(destPath, { recursive: true });
          await copyDirFiltered(srcPath, destPath, entryRel);
        } else if (entry.isFile()) {
          const content = await readFile(srcPath);
          await writeFile(destPath, content);
        }
      }
    }

    await copyDirFiltered(profileDir, stagingProfileDir);

    // Pack stagingRoot
    await packDir(stagingRoot, targetArchive);

    // Set file permission mode 0o600
    try {
      await chmod(targetArchive, 0o600);
    } catch {
      // chmod 0o600 might be a no-op or throw on some Windows filesystems, ignore if not supported
    }

    return {
      archivePath: targetArchive,
      manifest,
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

/**
 * Restores an isolated PWA profile from a .tar.gz archive.
 */
export async function restoreProfile(
  app: string,
  archiveFile: string,
  options: RestoreProfileOptions = {},
): Promise<RestoreProfileResult> {
  const profileDir = resolveStandaloneProfileDir(app, options.cacheDir);
  const appRootDir = path.dirname(profileDir);
  const archivePath = path.resolve(archiveFile);

  try {
    await stat(archivePath);
  } catch {
    throw new PwaNavError(
      'invalid_args',
      `Backup archive file does not exist: ${archivePath}`,
    );
  }

  // Inspect profile lock if profileDir exists
  let profileExists = false;
  try {
    await stat(profileDir);
    profileExists = true;
  } catch {
    profileExists = false;
  }

  if (profileExists) {
    const lockResult = await inspectProfileLock(profileDir, options.lockDeps);
    if (lockResult.state === 'held') {
      throw new PwaNavError(
        'session_busy',
        `Cannot restore profile for app '${app}': profile is currently in use by a running browser instance`,
        { hint: 'Close the PWA application before restoring a backup.' },
      );
    }
  }

  // Create sibling staging directory
  await mkdir(appRootDir, { recursive: true });
  const stagingDir = path.join(
    appRootDir,
    `profile.staging-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(stagingDir, { recursive: true });

  try {
    // Unpack archive into stagingDir
    await unpackFile(archivePath, stagingDir);

    // Validate manifest
    const manifestPath = path.join(stagingDir, 'manifest.json');
    let manifest: BackupManifest;
    try {
      const content = await readFile(manifestPath, 'utf8');
      manifest = JSON.parse(content) as BackupManifest;
    } catch {
      throw new PwaNavError(
        'invalid_args',
        `Invalid backup archive: missing or malformed manifest.json`,
      );
    }

    if ((manifest as { format?: unknown }).format !== 1) {
      throw new PwaNavError(
        'invalid_args',
        `Unsupported backup format: ${String(manifest.format)} (expected format: 1)`,
      );
    }

    if (manifest.app !== app && !options.force) {
      throw new PwaNavError(
        'invalid_args',
        `Archive was created for app '${manifest.app}', but target app is '${app}'. Use --force to restore anyway.`,
      );
    }

    // Validate profile structure
    const extractedProfileDir = path.join(stagingDir, 'profile');
    try {
      await stat(extractedProfileDir);
    } catch {
      throw new PwaNavError(
        'invalid_args',
        `Invalid backup archive: missing 'profile' directory in archive root`,
      );
    }

    const prefsPath = path.join(extractedProfileDir, 'prefs.js');
    const timesPath = path.join(extractedProfileDir, 'times.json');
    let hasPrefs = false;
    let hasTimes = false;
    try {
      await stat(prefsPath);
      hasPrefs = true;
    } catch {
      // not found
    }
    try {
      await stat(timesPath);
      hasTimes = true;
    } catch {
      // not found
    }

    if (!hasPrefs && !hasTimes) {
      throw new PwaNavError(
        'invalid_args',
        `Invalid backup archive: profile directory must contain prefs.js or times.json`,
      );
    }

    // Version warning check if compatibility.ini version is present
    let warning: string | undefined;
    const currentCompatibilityVersion = profileExists
      ? await readFirefoxCompatibilityVersion(profileDir)
      : undefined;

    if (
      manifest.firefoxVersion &&
      currentCompatibilityVersion &&
      manifest.firefoxVersion > currentCompatibilityVersion
    ) {
      warning = `Warning: The backup was created with a newer Firefox version (${manifest.firefoxVersion}) than the current profile (${currentCompatibilityVersion}).`;
    }

    // Atomic swap:
    // current profile/ -> profile.previous/
    // staging/profile -> profile/
    const previousProfileDir = path.join(appRootDir, 'profile.previous');

    if (profileExists) {
      // Remove any prior profile.previous if it exists
      await rm(previousProfileDir, { recursive: true, force: true });
      await rename(profileDir, previousProfileDir);
    }

    // Move staging/profile to profileDir
    await rename(extractedProfileDir, profileDir);

    return {
      app,
      restoredFrom: archivePath,
      ...(profileExists ? { previousProfileDir } : {}),
      manifest,
      ...(warning ? { warning } : {}),
    };
  } finally {
    // Always clean up stagingDir
    await rm(stagingDir, { recursive: true, force: true });
  }
}
