import { basename, join, resolve } from "node:path";
import { PwaNavError } from "./errors.js";
import { isPathInside } from "./gate.js";

const FORBIDDEN_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa",
]);

/**
 * Validates that an output destination path for downloads is inside an allowed safe root
 * and does not target sensitive system or project files.
 */
export function assertDownloadDestinationAllowed(
  outputPath: string,
  safeRoots: readonly string[] = [process.cwd(), resolve(".agent")],
): void {
  const resolved = resolve(outputPath);
  const base = basename(resolved).toLowerCase();

  if (base.startsWith(".env") || FORBIDDEN_FILE_NAMES.has(base)) {
    throw new PwaNavError("invalid_args", `download destination ${outputPath} targets a forbidden or sensitive file name`, {
      hint: "Files cannot be downloaded over sensitive configuration or key files.",
    });
  }

  const isInside = safeRoots.some((root) => isPathInside(resolved, root));
  if (!isInside) {
    throw new PwaNavError("invalid_args", `download destination ${outputPath} is outside allowed directories`, {
      hint: "Downloads must be saved inside workspace root or .agent directory.",
    });
  }
}

/**
 * Sanitizes or derives a safe filename from a URL or fallback name.
 */
export function sanitizeFilename(filename: string): string {
  // Strip protocol
  const noProto = filename.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  // Extract segment after last slash/backslash
  const segments = noProto.split(/[/\\]/);
  const last = segments[segments.length - 1] ?? "download";
  // Remove query string and hash fragments only if preceded by an extension or standard path separator
  // If the query string comes from a URL like /image.png?v=1
  let clean = last;
  const qIndex = clean.indexOf("?");
  const hIndex = clean.indexOf("#");
  const cutIndex = qIndex !== -1 && hIndex !== -1 ? Math.min(qIndex, hIndex) : qIndex !== -1 ? qIndex : hIndex;
  // If ? is immediately followed by a file extension (e.g. filename?.png), ? is an illegal char, not a query string delimiter!
  if (cutIndex !== -1) {
    const after = clean.slice(cutIndex + 1);
    if (!after.startsWith(".") && after.includes("=")) {
      clean = clean.slice(0, cutIndex);
    }
  }
  // Replace illegal filename characters across Windows & POSIX
  const base = clean.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return base.length > 0 ? base : "download";
}

/**
 * Resolves default or custom output path for a download request.
 */
export function resolveDownloadDestination(
  targetOut: string | undefined,
  suggestedFilename: string,
  workspaceRoot: string = process.cwd(),
): string {
  const sanitized = sanitizeFilename(suggestedFilename);
  if (!targetOut) {
    // Default to ./downloads/<filename>
    const defaultDir = join(workspaceRoot, "downloads");
    const fullPath = join(defaultDir, sanitized);
    assertDownloadDestinationAllowed(fullPath, [workspaceRoot, resolve(workspaceRoot, ".agent")]);
    return fullPath;
  }

  const resolved = resolve(workspaceRoot, targetOut);
  // If targetOut points to a directory or ends with a slash, append sanitized filename
  if (targetOut.endsWith("/") || targetOut.endsWith("\\")) {
    const fullPath = join(resolved, sanitized);
    assertDownloadDestinationAllowed(fullPath, [workspaceRoot, resolve(workspaceRoot, ".agent")]);
    return fullPath;
  }

  assertDownloadDestinationAllowed(resolved, [workspaceRoot, resolve(workspaceRoot, ".agent")]);
  return resolved;
}
