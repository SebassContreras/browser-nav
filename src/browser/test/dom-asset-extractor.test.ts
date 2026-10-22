import assert from "node:assert/strict";
import test from "node:test";
import { PwaNavError } from "../../core/errors.js";
import { extractAssetFromDom } from "../dom-asset-extractor.js";
import type { BidiClient } from "../../bidi/protocol.js";

test("dom-asset-extractor: extracts SVG markup successfully", async () => {
  const fakeClient = {
    callFunction: async () => {
      await Promise.resolve();
      return {
        kind: "svg",
        content: "<svg><path d='M0 0h10v10H0z'/></svg>",
        mimeType: "image/svg+xml",
        suggestedName: "logo.svg",
      };
    },
  } as unknown as BidiClient;

  const res = await extractAssetFromDom(fakeClient, "ctx-1", "#logo");
  assert.equal(res.kind, "svg");
  assert.equal(res.content, "<svg><path d='M0 0h10v10H0z'/></svg>");
  assert.equal(res.filename, "logo.svg");
});

test("dom-asset-extractor: extracts media src URL successfully", async () => {
  const fakeClient = {
    callFunction: async () => {
      await Promise.resolve();
      return {
        kind: "url",
        sourceUrl: "https://example.com/assets/video.mp4",
        suggestedName: "video.mp4",
      };
    },
  } as unknown as BidiClient;

  const res = await extractAssetFromDom(fakeClient, "ctx-1", "video");
  assert.equal(res.kind, "url");
  assert.equal(res.sourceUrl, "https://example.com/assets/video.mp4");
  assert.equal(res.filename, "video.mp4");
});

test("dom-asset-extractor: throws not_actionable when element is not found", async () => {
  const fakeClient = {
    callFunction: async () => {
      await Promise.resolve();
      return {
        error: "element_not_found",
      };
    },
  } as unknown as BidiClient;

  await assert.rejects(
    async () => extractAssetFromDom(fakeClient, "ctx-1", "#missing"),
    (err: unknown) => err instanceof PwaNavError && err.code === "not_actionable",
  );
});

test("dom-asset-extractor: throws not_actionable when element has no media", async () => {
  const fakeClient = {
    callFunction: async () => {
      await Promise.resolve();
      return {
        error: "unsupported_media_element",
      };
    },
  } as unknown as BidiClient;

  await assert.rejects(
    async () => extractAssetFromDom(fakeClient, "ctx-1", "div.text"),
    (err: unknown) => err instanceof PwaNavError && err.code === "not_actionable",
  );
});
