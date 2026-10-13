import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildFaviconUrl,
  createFallbackIco,
  DefaultAppIconService,
  isIcoBuffer,
  isPngBuffer,
  wrapPngInIco,
} from "../app-icon.js";

test("buildFaviconUrl derives origin /favicon.ico correctly", () => {
  assert.equal(buildFaviconUrl("https://example.com/some/path?foo=bar"), "https://example.com/favicon.ico");
  assert.equal(buildFaviconUrl("not-a-url"), null);
});

test("isIcoBuffer detects standard ICO magic bytes", () => {
  const ico = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]);
  assert.equal(isIcoBuffer(ico), true);

  const nonIco = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  assert.equal(isIcoBuffer(nonIco), false);
});

test("isPngBuffer detects PNG magic bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(isPngBuffer(png), true);

  const nonPng = Buffer.from([0x00, 0x00, 0x01, 0x00]);
  assert.equal(isPngBuffer(nonPng), false);
});

test("wrapPngInIco wraps PNG buffer into valid ICO container", () => {
  // Mock PNG with IHDR dimensions 16x16
  const fakePng = Buffer.alloc(32);
  fakePng[0] = 0x89;
  fakePng[1] = 0x50;
  fakePng[2] = 0x4e;
  fakePng[3] = 0x47;
  fakePng[4] = 0x0d;
  fakePng[5] = 0x0a;
  fakePng[6] = 0x1a;
  fakePng[7] = 0x0a;
  fakePng.writeUInt32BE(16, 16); // width
  fakePng.writeUInt32BE(16, 20); // height

  const wrapped = wrapPngInIco(fakePng);
  assert.equal(isIcoBuffer(wrapped), true);
  // Verify 1 image entry
  assert.equal(wrapped.readUInt16LE(4), 1);
  // Verify embedded width and height
  assert.equal(wrapped.readUInt8(6), 16);
  assert.equal(wrapped.readUInt8(7), 16);
});

test("createFallbackIco generates valid ICO buffer", () => {
  const fallback = createFallbackIco();
  assert.equal(isIcoBuffer(fallback), true);
  assert.ok(fallback.length > 50);
});

test("DefaultAppIconService saves ICO buffer when fetch succeeds", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pwa-nav-icon-test-"));
  const targetPath = join(tempDir, "icon.ico");

  try {
    const validIco = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    const mockFetch: typeof fetch = async () =>
      new Response(validIco, { status: 200, headers: { "content-type": "image/x-icon" } });

    const service = new DefaultAppIconService({ fetchFn: mockFetch });
    const result = await service.resolveIcon("https://example.com", targetPath);

    assert.equal(result, targetPath);
    const saved = await readFile(targetPath);
    assert.deepEqual(saved, validIco);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("DefaultAppIconService converts PNG buffer to ICO container", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pwa-nav-icon-png-"));
  const targetPath = join(tempDir, "icon.ico");

  try {
    const validPng = Buffer.alloc(32);
    validPng[0] = 0x89;
    validPng[1] = 0x50;
    validPng[2] = 0x4e;
    validPng[3] = 0x47;
    validPng[4] = 0x0d;
    validPng[5] = 0x0a;
    validPng[6] = 0x1a;
    validPng[7] = 0x0a;

    const mockFetch: typeof fetch = async () =>
      new Response(validPng, { status: 200, headers: { "content-type": "image/png" } });

    const service = new DefaultAppIconService({ fetchFn: mockFetch });
    const result = await service.resolveIcon("https://example.com", targetPath);

    assert.equal(result, targetPath);
    const saved = await readFile(targetPath);
    assert.equal(isIcoBuffer(saved), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("DefaultAppIconService returns null resiliently on network failure", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "pwa-nav-icon-fail-"));
  const targetPath = join(tempDir, "icon.ico");

  try {
    const mockFetch: typeof fetch = async () => {
      throw new Error("Network timeout");
    };

    const service = new DefaultAppIconService({ fetchFn: mockFetch });
    const result = await service.resolveIcon("https://example.com", targetPath);

    assert.equal(result, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
