import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import {
  inspectProfileLock,
  clearStaleLock,
  type FsDeps,
} from "../profile-lock.js";
import type { ProcessInspector, ProcessInfo } from "../process-inspector.js";
import { launchStandaloneAppClean } from "../standalone-runner.js";
import { PwaNavError } from "../../core/errors.js";

class FakeProcessInspector implements ProcessInspector {
  alivePids = new Set<number>();
  processes: ProcessInfo[] = [];

  isAlive(pid: number): boolean {
    return this.alivePids.has(pid);
  }

  findByArg(fragment: string): Promise<ProcessInfo[]> {
    const norm = fragment.toLowerCase().replace(/\\/g, "/");
    return Promise.resolve(
      this.processes.filter((p) =>
        p.command.toLowerCase().replace(/\\/g, "/").includes(norm),
      ),
    );
  }
}

class FakeFsDeps implements FsDeps {
  existingFiles = new Set<string>();
  symlinks = new Map<string, string>();
  exclusiveOpenFails = new Set<string>();
  unlinkedFiles: string[] = [];

  stat(p: string): Promise<unknown> {
    if (this.existingFiles.has(p)) {
      return Promise.resolve({});
    }
    return Promise.reject(new Error("ENOENT"));
  }

  readlink(p: string): Promise<string> {
    const target = this.symlinks.get(p);
    if (target !== undefined) {
      return Promise.resolve(target);
    }
    return Promise.reject(new Error("ENOENT"));
  }

  unlink(p: string): Promise<void> {
    this.existingFiles.delete(p);
    this.symlinks.delete(p);
    this.unlinkedFiles.push(p);
    return Promise.resolve();
  }

  tryOpenExclusive(p: string): boolean {
    if (this.exclusiveOpenFails.has(p)) {
      return false;
    }
    return this.existingFiles.has(p);
  }
}

function fakeSpawn(): ChildProcess {
  const ee = new EventEmitter() as ChildProcess;
  ee.pid = 9999;
  ee.unref = () => ee;
  return ee;
}

describe("profile-lock diagnostics (spec 008)", () => {
  it("free: returns free when no lock artifacts exist (Windows and POSIX)", async () => {
    const fakeFs = new FakeFsDeps();
    const inspector = new FakeProcessInspector();

    const resWin = await inspectProfileLock("C:/profiles/app", {
      platform: "win32",
      fs: fakeFs,
      inspector,
    });
    assert.equal(resWin.state, "free");
    assert.deepEqual(resWin.holders, []);

    const resPosix = await inspectProfileLock("/profiles/app", {
      platform: "linux",
      fs: fakeFs,
      inspector,
    });
    assert.equal(resPosix.state, "free");
    assert.deepEqual(resPosix.holders, []);
  });

  it("held with PID: returns held and reports holding process", async () => {
    const fakeFs = new FakeFsDeps();
    fakeFs.existingFiles.add("C:\\profiles\\app\\parent.lock");
    fakeFs.exclusiveOpenFails.add("C:\\profiles\\app\\parent.lock");

    const inspector = new FakeProcessInspector();
    inspector.alivePids.add(1234);
    inspector.processes.push({
      pid: 1234,
      command: "firefox.exe --profile C:\\profiles\\app",
    });

    const res = await inspectProfileLock("C:\\profiles\\app", {
      platform: "win32",
      fs: fakeFs,
      inspector,
    });
    assert.equal(res.state, "held");
    assert.equal(res.holders.length, 1);
    assert.equal(res.holders[0]?.pid, 1234);
  });

  it("stale cleared: clears orphaned parent.lock when locking process is dead", async () => {
    const fakeFs = new FakeFsDeps();
    fakeFs.existingFiles.add("C:\\profiles\\app\\parent.lock");
    // Can open exclusively (the holding process died, Windows freed the handle)

    const inspector = new FakeProcessInspector();
    // No matching process running

    const res = await inspectProfileLock("C:\\profiles\\app", {
      platform: "win32",
      fs: fakeFs,
      inspector,
    });
    assert.equal(res.state, "stale");
    assert.deepEqual(res.holders, []);

    const removed = await clearStaleLock("C:\\profiles\\app", {
      platform: "win32",
      fs: fakeFs,
      inspector,
    });
    assert.equal(removed.length, 1);
    assert.ok(removed[0]?.includes("parent.lock"));
    assert.equal(fakeFs.unlinkedFiles.length, 1);
  });

  it("PID reuse ignored: PID alive but does not hold profileDir is detected as stale", async () => {
    const fakeFs = new FakeFsDeps();
    fakeFs.existingFiles.add("/profiles/app/.parentlock");
    fakeFs.symlinks.set("/profiles/app/lock", "127.0.0.1:+5678");

    const inspector = new FakeProcessInspector();
    // PID 5678 is alive (reused by another app), but command line does not mention profileDir
    inspector.alivePids.add(5678);
    inspector.processes.push({
      pid: 5678,
      command: "node /other/script.js",
    });

    const res = await inspectProfileLock("/profiles/app", {
      platform: "linux",
      fs: fakeFs,
      inspector,
    });

    // In design D2: PID reuse -> stale because process does not hold profileDir
    assert.equal(res.state, "stale");
    assert.deepEqual(res.holders, []);
  });

  it("listing failure: degrades gracefully when process listing fails", async () => {
    const fakeFs = new FakeFsDeps();
    fakeFs.existingFiles.add("C:\\profiles\\app\\parent.lock");
    fakeFs.exclusiveOpenFails.add("C:\\profiles\\app\\parent.lock");

    const inspector = new FakeProcessInspector();
    // findByArg returns empty (e.g. timeout or command failure)
    inspector.findByArg = () => Promise.resolve([]);

    const res = await inspectProfileLock("C:\\profiles\\app", {
      platform: "win32",
      fs: fakeFs,
      inspector,
    });
    // Even without process listing, exclusive open failure identifies state as held
    assert.equal(res.state, "held");
    assert.deepEqual(res.holders, []);
  });

  it("runner refuses before spawn with session_busy naming PID", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "pwa-nav-test-"));
    try {
      const fakeFs = new FakeFsDeps();
      const parentLockPath = join(tmpDir, "apps", "testapp", "profile", "parent.lock");
      fakeFs.existingFiles.add(parentLockPath);
      fakeFs.exclusiveOpenFails.add(parentLockPath);

      let spawned = false;
      const testSpawn = () => {
        spawned = true;
        return fakeSpawn();
      };

      const lockDeps = {
        platform: "win32" as NodeJS.Platform,
        fs: fakeFs,
        inspector: {
          isAlive: () => true,
          findByArg: () => Promise.resolve([{ pid: 4321, command: "firefox.exe -P app" }]),
        },
      };

      await assert.rejects(
        launchStandaloneAppClean({
          url: "https://example.com",
          appSlug: "testapp",
          platform: "win32",
          cacheDir: tmpDir,
          spawnFn: testSpawn,
          lockDeps,
        }),
        (err: unknown) => {
          assert.ok(err instanceof PwaNavError);
          assert.equal(err.code, "session_busy");
          assert.ok(err.message.includes("4321"));
          assert.ok(err.message.includes("taskkill /PID 4321"));
          return true;
        },
      );

      assert.equal(spawned, false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
