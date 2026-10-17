import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as tar from 'tar';
import { PwaNavError } from '../../core/errors.js';
import { packDir, unpackFile } from '../archive.js';
import {
  backupProfile,
  isVolatileProfilePath,
  restoreProfile,
} from '../profile-backup.js';
import type { ProfileLockResult } from '../profile-lock.js';

describe('profile-backup', () => {
  describe('isVolatileProfilePath (D2)', () => {
    it('correctly filters volatile cache directories and lock files', () => {
      // Excluded
      assert.equal(isVolatileProfilePath('cache2/entries/123'), true);
      assert.equal(isVolatileProfilePath('startupCache/scriptCache.bin'), true);
      assert.equal(isVolatileProfilePath('thumbnails/page.png'), true);
      assert.equal(isVolatileProfilePath('jumpListCache/icon.ico'), true);
      assert.equal(isVolatileProfilePath('shader-cache/cache'), true);
      assert.equal(isVolatileProfilePath('crashes/store.json'), true);
      assert.equal(isVolatileProfilePath('minidumps/dump.dmp'), true);
      assert.equal(isVolatileProfilePath('datareporting/state.json'), true);
      assert.equal(isVolatileProfilePath('saved-telemetry-pings/ping'), true);
      assert.equal(isVolatileProfilePath('safebrowsing/list.sbstore'), true);
      assert.equal(isVolatileProfilePath('storage/temporary/cache'), true);
      assert.equal(isVolatileProfilePath('cookies.sqlite-shm'), true);
      assert.equal(isVolatileProfilePath('parent.lock'), true);
      assert.equal(isVolatileProfilePath('.parentlock'), true);
      assert.equal(isVolatileProfilePath('lock'), true);

      // Windows backslashes normalization
      assert.equal(isVolatileProfilePath('cache2\\entries\\abc'), true);
      assert.equal(isVolatileProfilePath('.\\parent.lock'), true);

      // Preserved non-volatile files
      assert.equal(isVolatileProfilePath('cookies.sqlite'), false);
      assert.equal(isVolatileProfilePath('cookies.sqlite-wal'), false);
      assert.equal(isVolatileProfilePath('places.sqlite'), false);
      assert.equal(isVolatileProfilePath('prefs.js'), false);
      assert.equal(isVolatileProfilePath('user.js'), false);
      assert.equal(isVolatileProfilePath('times.json'), false);
      assert.equal(isVolatileProfilePath('compatibility.ini'), false);
      assert.equal(isVolatileProfilePath('chrome/userChrome.css'), false);
      assert.equal(isVolatileProfilePath('storage/default/idb'), false);
    });
  });

  describe('backup and restore round trip (D1, D3)', () => {
    it('backs up a profile and restores it cleanly without volatile files', async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'pwa-backup-test-'));
      try {
        const appSlug = 'test-app';
        const profileDir = path.join(tempDir, 'apps', appSlug, 'profile');
        await mkdir(profileDir, { recursive: true });

        // Populate profile with state and volatile caches
        await writeFile(path.join(profileDir, 'prefs.js'), 'user_pref("test", true);', 'utf8');
        await writeFile(path.join(profileDir, 'cookies.sqlite'), 'sqlite-mock-data', 'utf8');
        await writeFile(path.join(profileDir, 'compatibility.ini'), '[Compatibility]\nLastVersion=158.0\n', 'utf8');

        // Volatile items that should be excluded
        const cacheDir = path.join(profileDir, 'cache2', 'entries');
        await mkdir(cacheDir, { recursive: true });
        await writeFile(path.join(cacheDir, 'transient.bin'), 'transient', 'utf8');
        await writeFile(path.join(profileDir, 'parent.lock'), 'lock-content', 'utf8');
        await writeFile(path.join(profileDir, 'cookies.sqlite-shm'), 'shm-content', 'utf8');

        // Execute backup
        const backupRes = await backupProfile(appSlug, { cacheDir: tempDir });
        assert.ok(existsSync(backupRes.archivePath));
        assert.equal(backupRes.manifest.app, appSlug);
        assert.equal(backupRes.manifest.firefoxVersion, '158.0');

        // Verify the archive contains non-volatile files and omitted cache
        const inspectionDir = path.join(tempDir, 'inspect');
        await mkdir(inspectionDir, { recursive: true });
        await unpackFile(backupRes.archivePath, inspectionDir);

        assert.ok(existsSync(path.join(inspectionDir, 'manifest.json')));
        assert.ok(existsSync(path.join(inspectionDir, 'profile', 'prefs.js')));
        assert.ok(existsSync(path.join(inspectionDir, 'profile', 'cookies.sqlite')));
        assert.ok(!existsSync(path.join(inspectionDir, 'profile', 'cache2')));
        assert.ok(!existsSync(path.join(inspectionDir, 'profile', 'parent.lock')));
        assert.ok(!existsSync(path.join(inspectionDir, 'profile', 'cookies.sqlite-shm')));

        // Now mutate profile and perform restore
        await writeFile(path.join(profileDir, 'prefs.js'), 'mutated', 'utf8');

        const restoreRes = await restoreProfile(appSlug, backupRes.archivePath, { cacheDir: tempDir });
        assert.equal(restoreRes.app, appSlug);
        assert.ok(restoreRes.previousProfileDir);
        assert.ok(existsSync(restoreRes.previousProfileDir));

        // Restored profile has original content
        const restoredPrefs = await readFile(path.join(profileDir, 'prefs.js'), 'utf8');
        assert.equal(restoredPrefs, 'user_pref("test", true);');

        // Previous profile dir has the mutated content
        const previousPrefs = await readFile(path.join(restoreRes.previousProfileDir, 'prefs.js'), 'utf8');
        assert.equal(previousPrefs, 'mutated');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('app mismatch and --force behavior', () => {
    it('refuses restore on app mismatch unless force is passed', async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'pwa-backup-mismatch-'));
      try {
        const appA = 'app-a';
        const profileA = path.join(tempDir, 'apps', appA, 'profile');
        await mkdir(profileA, { recursive: true });
        await writeFile(path.join(profileA, 'prefs.js'), 'pref-a', 'utf8');

        const backupRes = await backupProfile(appA, { cacheDir: tempDir });

        // Attempt restore to app-b without force -> should throw
        await assert.rejects(
          async () => {
            await restoreProfile('app-b', backupRes.archivePath, { cacheDir: tempDir });
          },
          (err: unknown) => {
            return (
              err instanceof PwaNavError &&
              err.code === 'invalid_args' &&
              err.message.includes("Archive was created for app 'app-a', but target app is 'app-b'")
            );
          },
        );

        // Attempt restore to app-b WITH force -> should succeed
        const forceRes = await restoreProfile('app-b', backupRes.archivePath, {
          cacheDir: tempDir,
          force: true,
        });
        assert.equal(forceRes.app, 'app-b');
        const restoredPrefsB = await readFile(
          path.join(tempDir, 'apps', 'app-b', 'profile', 'prefs.js'),
          'utf8',
        );
        assert.equal(restoredPrefsB, 'pref-a');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('held profile protection (session_busy)', () => {
    it('refuses backup and restore when profile lock is held', async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'pwa-backup-lock-'));
      try {
        const app = 'held-app';
        const profileDir = path.join(tempDir, 'apps', app, 'profile');
        await mkdir(profileDir, { recursive: true });
        await writeFile(path.join(profileDir, 'prefs.js'), 'pref', 'utf8');

        const heldLockDeps = {
          fs: {
            stat: () => Promise.resolve({}),
            readlink: () => Promise.resolve(''),
            unlink: () => Promise.resolve(),
            tryOpenExclusive: () => false,
          },
          inspector: {
            isAlive: () => true,
            findByArg: (): Promise<ProfileLockResult['holders']> =>
              Promise.resolve([{ pid: 9999, command: `firefox -profile ${profileDir}` }]),
          },
        };

        // Backup refused
        await assert.rejects(
          async () => {
            await backupProfile(app, { cacheDir: tempDir, lockDeps: heldLockDeps });
          },
          (err: unknown) => {
            return err instanceof PwaNavError && err.code === 'session_busy';
          },
        );

        // Make a valid backup with free lock
        const backupRes = await backupProfile(app, { cacheDir: tempDir });

        // Restore refused when held
        await assert.rejects(
          async () => {
            await restoreProfile(app, backupRes.archivePath, {
              cacheDir: tempDir,
              lockDeps: heldLockDeps,
            });
          },
          (err: unknown) => {
            return err instanceof PwaNavError && err.code === 'session_busy';
          },
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('failed restore keeps current profile', () => {
    it('aborts without touching existing profile if archive is corrupted or missing manifest', async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'pwa-backup-corrupt-'));
      try {
        const app = 'corrupt-test';
        const profileDir = path.join(tempDir, 'apps', app, 'profile');
        await mkdir(profileDir, { recursive: true });
        await writeFile(path.join(profileDir, 'prefs.js'), 'original-state', 'utf8');

        // Create a bogus tar archive without manifest.json
        const badArchive = path.join(tempDir, 'bad.tar.gz');
        const emptyDir = path.join(tempDir, 'empty');
        await mkdir(emptyDir, { recursive: true });
        await packDir(emptyDir, badArchive);

        await assert.rejects(
          async () => {
            await restoreProfile(app, badArchive, { cacheDir: tempDir });
          },
          (err: unknown) => {
            return err instanceof PwaNavError && err.code === 'invalid_args';
          },
        );

        // Original state must be untouched
        const currentPrefs = await readFile(path.join(profileDir, 'prefs.js'), 'utf8');
        assert.equal(currentPrefs, 'original-state');
        assert.ok(!existsSync(path.join(tempDir, 'apps', app, 'profile.previous')));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('link entries rejected (security)', () => {
    it('rejects archive extraction when it contains symlink entries', async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'pwa-backup-links-'));
      try {
        const maliciousTar = path.join(tempDir, 'malicious.tar.gz');
        const packSource = path.join(tempDir, 'source');
        await mkdir(packSource, { recursive: true });
        await writeFile(path.join(packSource, 'file.txt'), 'hello');

        // Create tar with a simulated symlink entry using tar.create or custom header
        // Using tar.Pack or tar.create:
        await tar.create(
          {
            gzip: true,
            file: maliciousTar,
            cwd: packSource,
          },
          ['file.txt'],
        );

        // Test unpackFile security directly with a crafted symlink if platform supports symlinks,
        // or test unpacking an archive where filter checks SymbolicLink type.
        // Let's create an archive containing a link entry:
        let createdLink = false;
        try {
          const { symlink } = await import('node:fs/promises');
          await symlink('file.txt', path.join(packSource, 'symlink.txt'));
          createdLink = true;
          await tar.create(
            {
              gzip: true,
              file: maliciousTar,
              cwd: packSource,
            },
            ['file.txt', 'symlink.txt'],
          );
        } catch {
          // On Windows if developer mode is off, symlink creation might fail with EPERM.
          createdLink = false;
        }

        if (createdLink) {
          const extractDir = path.join(tempDir, 'extracted');
          await mkdir(extractDir, { recursive: true });

          await assert.rejects(
            async () => {
              await unpackFile(maliciousTar, extractDir);
            },
            (err: unknown) => {
              return (
                err instanceof PwaNavError &&
                err.code === 'invalid_args' &&
                err.message.includes('Archive contains forbidden link entry')
              );
            },
          );
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
