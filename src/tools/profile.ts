import {
  backupProfile,
  restoreProfile,
  type BackupProfileResult,
  type RestoreProfileResult,
} from "../browser/profile-backup.js";
import { PwaNavError } from "../core/errors.js";
import { type ToolOutcome } from "./types.js";

export interface ProfileBackupArgs {
  app: string;
  out?: string;
}

export interface ProfileRestoreArgs {
  app: string;
  file: string;
  force?: boolean;
}

export interface ProfileToolOptions {
  cacheDir?: string;
}

export async function profileBackupTool(
  args: ProfileBackupArgs,
  options: ProfileToolOptions = {},
): Promise<ToolOutcome & { structured: BackupProfileResult & Record<string, unknown> }> {
  if (!args.app || args.app.trim() === "") {
    throw new PwaNavError("invalid_args", "profile backup requires an app name", {
      hint: "pwa-nav profile backup <app> [--out <file>]",
    });
  }

  const result = await backupProfile(args.app, {
    ...(args.out ? { out: args.out } : {}),
    cacheDir: options.cacheDir,
  });

  const lines = [
    `Profile backup created for '${result.manifest.app}': ${result.archivePath}`,
    `Warning: this archive contains live session cookies and credentials. Treat as a password!`,
  ];

  return {
    text: lines.join("\n"),
    structured: {
      archivePath: result.archivePath,
      manifest: { ...result.manifest },
    },
  };
}

export async function profileRestoreTool(
  args: ProfileRestoreArgs,
  options: ProfileToolOptions = {},
): Promise<ToolOutcome & { structured: RestoreProfileResult & Record<string, unknown> }> {
  if (!args.app || args.app.trim() === "") {
    throw new PwaNavError("invalid_args", "profile restore requires an app name", {
      hint: "pwa-nav profile restore <app> <file> [--force]",
    });
  }
  if (!args.file || args.file.trim() === "") {
    throw new PwaNavError("invalid_args", "profile restore requires an archive file path", {
      hint: "pwa-nav profile restore <app> <file> [--force]",
    });
  }

  const result = await restoreProfile(args.app, args.file, {
    force: args.force,
    cacheDir: options.cacheDir,
  });

  const lines = [
    `Profile restored successfully for '${result.app}' from ${result.restoredFrom}`,
  ];
  if (result.previousProfileDir) {
    lines.push(`Previous profile backed up at: ${result.previousProfileDir}`);
  }
  if (result.warning) {
    lines.push(result.warning);
  }

  return {
    text: lines.join("\n"),
    structured: {
      app: result.app,
      restoredFrom: result.restoredFrom,
      ...(result.previousProfileDir ? { previousProfileDir: result.previousProfileDir } : {}),
      manifest: { ...result.manifest },
      ...(result.warning ? { warning: result.warning } : {}),
    },
  };
}
