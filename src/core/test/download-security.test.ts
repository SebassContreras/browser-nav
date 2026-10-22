import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { PwaNavError } from "../errors.js";
import {
  assertDownloadDestinationAllowed,
  resolveDownloadDestination,
  sanitizeFilename,
} from "../download-security.js";

test("download-security: sanitizeFilename strips query, hash, and dangerous characters", () => {
  assert.equal(sanitizeFilename("icon.svg?v=123#frag"), "icon.svg");
  assert.equal(sanitizeFilename("../../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("my:file*name?.png"), "my_file_name_.png");
  assert.equal(sanitizeFilename(""), "download");
});

test("download-security: assertDownloadDestinationAllowed allows paths within safe roots", () => {
  const root = resolve("./test-root");
  assert.doesNotThrow(() => {
    assertDownloadDestinationAllowed(join(root, "downloads", "image.png"), [root]);
  });
  assert.doesNotThrow(() => {
    assertDownloadDestinationAllowed(join(root, ".agent", "asset.svg"), [root]);
  });
});

test("download-security: assertDownloadDestinationAllowed rejects traversal and external paths", () => {
  const root = resolve("./test-root");
  assert.throws(
    () => {
      assertDownloadDestinationAllowed(resolve("../outside/file.png"), [root]);
    },
    (err: unknown) => err instanceof PwaNavError && err.code === "invalid_args",
  );
});

test("download-security: assertDownloadDestinationAllowed rejects sensitive files", () => {
  const root = resolve("./test-root");
  assert.throws(
    () => {
      assertDownloadDestinationAllowed(join(root, ".env"), [root]);
    },
    (err: unknown) => err instanceof PwaNavError && err.code === "invalid_args",
  );
  assert.throws(
    () => {
      assertDownloadDestinationAllowed(join(root, "id_rsa"), [root]);
    },
    (err: unknown) => err instanceof PwaNavError && err.code === "invalid_args",
  );
});

test("download-security: resolveDownloadDestination defaults to ./downloads/<filename>", () => {
  const root = resolve("./test-root");
  const dest = resolveDownloadDestination(undefined, "chart.svg", root);
  assert.equal(dest, join(root, "downloads", "chart.svg"));
});

test("download-security: resolveDownloadDestination appends filename if directory given", () => {
  const root = resolve("./test-root");
  const dest = resolveDownloadDestination("custom-dir/", "video.mp4", root);
  assert.equal(dest, join(root, "custom-dir", "video.mp4"));
});
