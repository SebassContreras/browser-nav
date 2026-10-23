import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PwaNavError } from "../errors.js";
import {
  extractAllowedOrigins,
  FileAppRegistry,
  MemoryAppRegistry,
  normalizeOrigin,
  resolveCanonicalSlug,
} from "../app-registry.js";

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pwa-nav-app-reg-"));
}

test("normalizeOrigin: normalizes valid http/https URLs and rejects invalid ones", () => {
  // Arrange & Act & Assert
  assert.equal(normalizeOrigin("https://notebook.google.com/u/0/"), "https://notebook.google.com");
  assert.equal(normalizeOrigin("HTTP://example.com:80/path?query=1"), "http://example.com");
  assert.equal(normalizeOrigin("invalid-string"), null);
  assert.equal(normalizeOrigin("file:///C:/path"), null);
});

test("resolveCanonicalSlug: given mapped origin, returns canonical app slug", () => {
  // Arrange
  const config = {
    apps: {
      "notebooklm-google-com": {
        name: "Google NotebookLM",
        origins: ["https://notebooklm.google.com", "https://notebook.google.com"],
      },
    },
  };

  // Act & Assert
  assert.equal(
    resolveCanonicalSlug("https://notebook.google.com/test", config),
    "notebooklm-google-com",
  );
  assert.equal(
    resolveCanonicalSlug("https://notebooklm.google.com/app", config),
    "notebooklm-google-com",
  );
});

test("resolveCanonicalSlug: given unmapped origin, falls back to hostname slug", () => {
  // Arrange
  const config = {
    apps: {
      "other-app": { origins: ["https://other.com"] },
    },
  };

  // Act & Assert
  assert.equal(resolveCanonicalSlug("https://example.com/page", config), "example-com");
});

test("extractAllowedOrigins: aggregates origins from both flat list and apps map", () => {
  // Arrange
  const config = {
    origins: ["https://legacy.com/path", "https://shared.com"],
    apps: {
      "app-one": { origins: ["https://shared.com/", "https://app-one.com"] },
      "app-two": { origins: ["https://app-two.com"] },
    },
  };

  // Act
  const origins = extractAllowedOrigins(config);

  // Assert
  assert.deepEqual(origins, [
    "https://app-one.com",
    "https://app-two.com",
    "https://legacy.com",
    "https://shared.com",
  ]);
});

test("MemoryAppRegistry: registers app origin and resolves slug in memory", async () => {
  // Arrange
  const registry = new MemoryAppRegistry();

  // Act
  await registry.registerAppOrigin("https://notebook.google.com/u/0", "notebooklm-google-com", "NotebookLM");

  // Assert
  const resolved = await registry.resolveSlug("https://notebook.google.com/subpath");
  assert.equal(resolved, "notebooklm-google-com");

  const allowed = await registry.getAllowedOrigins();
  assert.deepEqual(allowed, ["https://notebook.google.com"]);
});

test("MemoryAppRegistry: rejects invalid origins with invalid_args error", async () => {
  // Arrange
  const registry = new MemoryAppRegistry();

  // Act & Assert
  await assert.rejects(
    async () => registry.registerAppOrigin("not-a-url", "some-slug"),
    (err: unknown) => err instanceof PwaNavError && err.code === "invalid_args",
  );
});

test("FileAppRegistry: loads legacy allow.json with origins array", async () => {
  // Arrange
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, "allow.json"), JSON.stringify({ origins: ["https://example.com"] }), "utf8");
    const registry = new FileAppRegistry(dir);

    // Act
    const config = await registry.load();
    const slug = await registry.resolveSlug("https://example.com");

    // Assert
    assert.deepEqual(config.origins, ["https://example.com"]);
    assert.equal(slug, "example-com");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("FileAppRegistry: returns empty config when allow.json is missing", async () => {
  // Arrange
  const dir = await makeTempDir();
  try {
    const registry = new FileAppRegistry(dir);

    // Act
    const config = await registry.load();

    // Assert
    assert.deepEqual(config, { origins: [], apps: {} });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("FileAppRegistry: registers origin atomically and persists to disk", async () => {
  // Arrange
  const dir = await makeTempDir();
  try {
    const registry = new FileAppRegistry(dir);

    // Act
    await registry.registerAppOrigin("https://notebook.google.com", "notebooklm-google-com", "Google NotebookLM");
    await registry.registerAppOrigin("https://notebooklm.google.com", "notebooklm-google-com");

    // Assert
    const fileContent = JSON.parse(await readFile(join(dir, "allow.json"), "utf8")) as {
      apps: Record<string, { name?: string; origins: string[] }>;
    };

    assert.ok(fileContent.apps["notebooklm-google-com"]);
    assert.equal(fileContent.apps["notebooklm-google-com"].name, "Google NotebookLM");
    assert.deepEqual(fileContent.apps["notebooklm-google-com"].origins, [
      "https://notebook.google.com",
      "https://notebooklm.google.com",
    ]);

    const slug = await registry.resolveSlug("https://notebook.google.com/resource");
    assert.equal(slug, "notebooklm-google-com");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveCanonicalSlug: uniformly strips leading www. and handles apex and www origins identically", () => {
  const config = {};
  assert.equal(resolveCanonicalSlug("https://www.linkedin.com/feed", config), "linkedin-com");
  assert.equal(resolveCanonicalSlug("https://linkedin.com/feed", config), "linkedin-com");
  assert.equal(resolveCanonicalSlug("www.mercadona.es", config), "mercadona-es");
  assert.equal(resolveCanonicalSlug("mercadona.es", config), "mercadona-es");
});
