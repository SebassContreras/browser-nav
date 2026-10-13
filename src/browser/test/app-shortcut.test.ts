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
    targetBinary: "C:\\Program Files\\FirefoxPWA\\firefox.exe",
    args: ["--profile", "C:\\Users\\user\\profile dir", "--pwa", "linkedin"],
    iconPath: "C:\\Users\\user\\icon.ico",
    destinationDir: "C:\\Users\\user\\apps",
  };

  const script = buildWindowsShortcutScript(options, "C:\\Users\\user\\apps\\linkedin.lnk");
  assert.match(script, /New-Object -ComObject WScript\.Shell/);
  assert.match(script, /C:\\Users\\user\\apps\\linkedin\.lnk/);
  assert.match(script, /TargetPath = 'C:\\Program Files\\FirefoxPWA\\firefox\.exe'/);
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

test("WindowsShortcutService delegates to execFn", async () => {
  let executedCmd: string | null = null;
  let executedArgs: readonly string[] | null = null;

  const mockExec: any = async (file: string, args: readonly string[]) => {
    executedCmd = file;
    executedArgs = args;
    return { stdout: "", stderr: "" };
  };

  const service = new WindowsShortcutService({ execFn: mockExec });
  const result = await service.createShortcut({
    name: "demo",
    targetBinary: "firefox.exe",
    args: ["--pwa", "demo"],
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
