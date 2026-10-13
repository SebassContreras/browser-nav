import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Configuration options required to create or update an OS application shortcut.
 */
export interface ShortcutOptions {
  /** Name of the application / shortcut title. */
  name: string;
  /** Path to the target binary executable. */
  targetBinary: string;
  /** CLI arguments passed to target binary. */
  args: string[];
  /** Absolute path to the icon file (.ico on Windows). */
  iconPath: string;
  /** Working directory (optional). */
  workingDir?: string;
  /** Destination directory where the shortcut file (.lnk) will be placed. */
  destinationDir: string;
}

/**
 * Service boundary interface for OS desktop / application shortcuts.
 * Anti-Corruption Layer (SRP): Isolates OS-specific shortcut persistence (Windows .lnk, Linux .desktop).
 */
export interface AppShortcutService {
  /**
   * Generates or updates the desktop shortcut file.
   * Returns the absolute path to the generated shortcut, or null if unsupported/failed.
   */
  createShortcut(options: ShortcutOptions): Promise<string | null>;
}

/**
 * Builds the PowerShell script string that calls WScript.Shell COM object to create a .lnk shortcut.
 * Uses exact argument string formatting with quoted parameters.
 */
export function buildWindowsShortcutScript(options: ShortcutOptions, shortcutPath: string): string {
  // Join arguments, quoting any arguments containing spaces or quotes
  const formattedArgs = options.args
    .map((arg) => (arg.includes(" ") ? `\`"${arg.replace(/"/g, '`"')}\`"` : arg))
    .join(" ");

  const workDir = options.workingDir ?? dirname(options.targetBinary);

  return [
    `$w = New-Object -ComObject WScript.Shell`,
    `$s = $w.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')`,
    `$s.TargetPath = '${options.targetBinary.replace(/'/g, "''")}'`,
    `$s.Arguments = '${formattedArgs.replace(/'/g, "''")}'`,
    `$s.IconLocation = '${options.iconPath.replace(/'/g, "''")},0'`,
    `$s.WorkingDirectory = '${workDir.replace(/'/g, "''")}'`,
    `$s.Save()`,
  ].join("; ");
}

/**
 * Windows implementation of AppShortcutService using WScript.Shell COM via PowerShell.
 */
export class WindowsShortcutService implements AppShortcutService {
  private readonly execFn: typeof execFileAsync;

  constructor(options: { execFn?: typeof execFileAsync } = {}) {
    this.execFn = options.execFn ?? execFileAsync;
  }

  async createShortcut(options: ShortcutOptions): Promise<string | null> {
    if (process.platform !== "win32") {
      return null;
    }

    try {
      await mkdir(options.destinationDir, { recursive: true });
      const shortcutPath = join(options.destinationDir, `${options.name}.lnk`);
      const script = buildWindowsShortcutScript(options, shortcutPath);

      await this.execFn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
      return shortcutPath;
    } catch {
      return null;
    }
  }
}

/**
 * Non-operating system or mock implementation of AppShortcutService.
 */
export class NoopShortcutService implements AppShortcutService {
  async createShortcut(_options: ShortcutOptions): Promise<string | null> {
    return null;
  }
}
