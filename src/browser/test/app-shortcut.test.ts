import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWindowsShortcutScript,
  NoopShortcutService,
  type ShortcutOptions,
  WindowsShortcutService,
} from "../app-shortcut.js";

test("buildWindowsShortcutScript formats PowerShell COM script correctly", () => {
  const options: ShortcutOptions = {
    name: "linkedin",
    targetBinary: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    args: ["--profile", "C:\\Users\\user\\profile dir", "https://www.linkedin.com"],
    iconPath: "C:\\Users\\user\\icon.ico",
    destinationDir: "C:\\Users\\user\\apps",
  };

  const script = buildWindowsShortcutScript(options, "C:\\Users\\user\\apps\\linkedin.lnk");
  assert.match(script, /New-Object -ComObject WScript\.Shell/);
  assert.match(script, /C:\\Users\\user\\apps\\linkedin\.lnk/);
  assert.match(script, /TargetPath = 'C:\\Program Files\\Mozilla Firefox\\firefox\.exe'/);
  // Arguments with spaces should be escaped
  assert.match(script, /`"C:\\Users\\user\\profile dir`"/);
  assert.match(script, /IconLocation = 'C:\\Users\\user\\icon\.ico,0'/);
});

test("NoopShortcutService returns null cleanly", async () => {
  const service = new NoopShortcutService();
  const result = await service.createShortcut({
    name: "test",
    targetBinary: "app.exe",
    args: [],
    iconPath: "icon.ico",
    destinationDir: ".",
  });
  assert.equal(result, null);
});

import type { execFile } from "node:child_process";
import type { promisify } from "node:util";

type ExecFileAsync = ReturnType<typeof promisify<typeof execFile>>;

test("WindowsShortcutService delegates to execFn", async () => {
  let executedCmd: string | null = null;
  let executedArgs: readonly string[] | null = null;

  const mockExec: ExecFileAsync = (async (
    file: string,
    args?: readonly string[] | null,
  ): Promise<{ stdout: string; stderr: string }> => {
    await Promise.resolve();
    executedCmd = file;
    executedArgs = args ?? null;
    return { stdout: "", stderr: "" };
  }) as unknown as ExecFileAsync;

  const service = new WindowsShortcutService({
    execFn: mockExec,
  });
  const result = await service.createShortcut({
    name: "demo",
    targetBinary: "firefox.exe",
    args: ["https://demo.test"],
    iconPath: "C:\\app\\icon.ico",
    destinationDir: "C:\\app",
  });

  if (process.platform === "win32") {
    assert.equal(result, "C:\\app\\demo.lnk");
    assert.equal(executedCmd, "powershell.exe");
    assert.ok(executedArgs);
    assert.ok((executedArgs as readonly string[] | null)?.includes("-Command"));
  } else {
    assert.equal(result, null);
  }
});
