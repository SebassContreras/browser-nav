import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { withTopLevelContext } from "../bidi/session.js";
import { endpointFor } from "../browser/bidi-backend.js";
import { OfflineBackend } from "../backend/backend.js";
import { PwaNavError } from "../core/errors.js";
import { resolveDownloadDestination, sanitizeFilename } from "../core/download-security.js";
import { extractAssetFromDom } from "../browser/dom-asset-extractor.js";
import { invalid, type ToolContext, type ToolOutcome } from "./types.js";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

export interface DownloadArgs {
  url?: string;
  target?: string;
  ref?: string;
  out?: string;
  dryRun?: boolean;
}

export interface DownloadResult {
  kind: "dry-run" | "saved";
  path: string;
  sourceUrl?: string;
  bytes?: number;
}

/**
 * Downloads a remote URL or extracts an in-page media/SVG asset to a local file.
 * Non-automatic: only executes upon explicit user or agent request.
 */
export async function downloadTool(args: DownloadArgs, ctx: ToolContext): Promise<ToolOutcome> {
  const { url, target, ref, out, dryRun } = args;
  const isDryRun = dryRun ?? !ctx.armed;

  if (!url && !target && !ref) {
    throw invalid("must provide either url, target (@id), or ref to download.");
  }

  const workspaceRoot = ctx.screens.workspaceDir ?? process.cwd();

  // Mode 1: Direct remote URL
  if (url) {
    const filename = sanitizeFilename(url);
    const dest = resolveDownloadDestination(out, filename, workspaceRoot);

    if (isDryRun) {
      return {
        text: `download dry-run: would download ${url} -> ${dest}`,
        structured: { kind: "dry-run", sourceUrl: url, path: dest },
      };
    }

    await mkdir(dirname(dest), { recursive: true });

    // Download via fetch streaming
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new PwaNavError("not_actionable", `failed to download ${url}: HTTP ${String(resp.status)} ${resp.statusText}`);
    }

    if (!resp.body) {
      throw new PwaNavError("not_actionable", `empty response body downloading ${url}`);
    }

    const nodeStream = Readable.fromWeb(resp.body as NodeReadableStream<Uint8Array>);
    const fileStream = createWriteStream(dest);
    await pipeline(nodeStream, fileStream);

    return {
      text: `download ok: ${url} -> ${dest}`,
      structured: { kind: "saved", sourceUrl: url, path: dest },
    };
  }

  // Mode 2: In-browser element extraction (target or ref)
  const selectorOrRef = target ?? ref ?? "";

  if (ctx.mode === "offline" || ctx.backend instanceof OfflineBackend) {
    const filename = "extracted.svg";
    const dest = resolveDownloadDestination(out, filename, workspaceRoot);
    if (isDryRun) {
      return {
        text: `download dry-run: would extract asset from ${selectorOrRef} -> ${dest}`,
        structured: { kind: "dry-run", path: dest },
      };
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, `<svg xmlns="http://www.w3.org/2000/svg"><text>${selectorOrRef}</text></svg>`, "utf8");
    return {
      text: `download ok: extracted asset from ${selectorOrRef} -> ${dest}`,
      structured: { kind: "saved", path: dest },
    };
  }

  // Bidi live browser session
  const endpoint = endpointFor(ctx.port ?? 9222);
  return await withTopLevelContext(endpoint, async (client, context) => {
    const asset = await extractAssetFromDom(client, context, selectorOrRef);
    const filename = sanitizeFilename(asset.filename ?? (asset.kind === "svg" ? "asset.svg" : "asset"));
    const dest = resolveDownloadDestination(out, filename, workspaceRoot);

    if (isDryRun) {
      return {
        text: `download dry-run: would extract ${asset.kind} from ${selectorOrRef} -> ${dest}`,
        structured: { kind: "dry-run", path: dest, sourceUrl: asset.sourceUrl },
      };
    }

    await mkdir(dirname(dest), { recursive: true });

    if (asset.kind === "svg" && asset.content) {
      await writeFile(dest, asset.content, "utf8");
      return {
        text: `download ok: extracted SVG from ${selectorOrRef} -> ${dest}`,
        structured: { kind: "saved", path: dest, mimeType: "image/svg+xml" },
      };
    }

    if (asset.sourceUrl) {
      const resp = await fetch(asset.sourceUrl);
      if (!resp.ok) {
        throw new PwaNavError("not_actionable", `failed to download extracted url ${asset.sourceUrl}: HTTP ${String(resp.status)}`);
      }
      if (!resp.body) {
        throw new PwaNavError("not_actionable", `empty body downloading ${asset.sourceUrl}`);
      }
      const nodeStream = Readable.fromWeb(resp.body as NodeReadableStream<Uint8Array>);
      const fileStream = createWriteStream(dest);
      await pipeline(nodeStream, fileStream);

      return {
        text: `download ok: extracted and saved ${asset.sourceUrl} -> ${dest}`,
        structured: { kind: "saved", path: dest, sourceUrl: asset.sourceUrl },
      };
    }

    throw new PwaNavError("not_actionable", `could not extract content from ${selectorOrRef}`);
  });
}
