import type { BidiClient } from "../bidi/protocol.js";
import { PwaNavError } from "../core/errors.js";

export interface ExtractedAsset {
  kind: "svg" | "url" | "blob";
  sourceUrl?: string;
  filename?: string;
  content?: string; // serialized XML or base64 data
  mimeType?: string;
}

/**
 * Script executed inside the target browser page to locate an element
 * and extract its download link or serialized SVG content.
 */
export const EXTRACT_ASSET_SCRIPT = `
function extractAsset(selectorOrQuery) {
  let el = null;
  if (selectorOrQuery.startsWith("#") || selectorOrQuery.startsWith(".") || selectorOrQuery.startsWith("[")) {
    try { el = document.querySelector(selectorOrQuery); } catch {}
  }
  if (!el) {
    // Try matching by id, ref or text content
    const all = Array.from(document.querySelectorAll("svg, img, video, audio, source, a"));
    for (const item of all) {
      if (item.id === selectorOrQuery || item.getAttribute("data-ref") === selectorOrQuery) {
        el = item;
        break;
      }
    }
  }
  if (!el && selectorOrQuery) {
    // Fallback: search by tag or any query
    try { el = document.querySelector(selectorOrQuery); } catch {}
  }
  if (!el) {
    return { error: "element_not_found" };
  }

  // 1. If it's an SVG or contains an SVG
  const svgEl = el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg");
  if (svgEl) {
    const xml = new XMLSerializer().serializeToString(svgEl);
    return {
      kind: "svg",
      content: xml,
      mimeType: "image/svg+xml",
      suggestedName: (svgEl.getAttribute("id") || svgEl.getAttribute("aria-label") || "extracted") + ".svg"
    };
  }

  // 2. If it's an <img>, <video>, <audio>, <source>, or <a>
  const tag = el.tagName.toLowerCase();
  let src = "";
  if (tag === "img" || tag === "video" || tag === "audio" || tag === "source") {
    src = el.currentSrc || el.src || el.getAttribute("src") || "";
  } else if (tag === "a") {
    src = el.href || el.getAttribute("href") || "";
  } else {
    // Check if child image/media exists
    const childMedia = el.querySelector("img, video, audio, source, a");
    if (childMedia) {
      src = childMedia.currentSrc || childMedia.src || childMedia.href || "";
    }
  }

  if (src) {
    return {
      kind: "url",
      sourceUrl: src,
      suggestedName: src.split("/").pop()?.split(/[?#]/)[0] || "download"
    };
  }

  return { error: "unsupported_media_element" };
}
`;

/**
 * Executes in-page asset extraction on the top-level context via WebDriver BiDi.
 */
export async function extractAssetFromDom(
  client: BidiClient,
  context: string,
  selectorOrQuery: string,
): Promise<ExtractedAsset> {
  const result = (await client.callFunction(
    context,
    EXTRACT_ASSET_SCRIPT,
    [{ type: "string", value: selectorOrQuery }],
    true,
  )) as Record<string, unknown> | null;

  if (result === null || typeof result !== "object") {
    throw new PwaNavError("not_actionable", `failed to inspect DOM element: ${selectorOrQuery}`);
  }

  if (result.error === "element_not_found") {
    throw new PwaNavError("not_actionable", `no media or SVG element found matching: ${selectorOrQuery}`);
  }

  if (result.error === "unsupported_media_element") {
    throw new PwaNavError("not_actionable", `element ${selectorOrQuery} does not contain an SVG, image, or media link`);
  }

  return {
    kind: result.kind as "svg" | "url" | "blob",
    sourceUrl: typeof result.sourceUrl === "string" ? result.sourceUrl : undefined,
    filename: typeof result.suggestedName === "string" ? result.suggestedName : undefined,
    content: typeof result.content === "string" ? result.content : undefined,
    mimeType: typeof result.mimeType === "string" ? result.mimeType : undefined,
  };
}
