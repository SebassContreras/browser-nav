import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { resolveAppTarget } from "../../backend/backend.js";
import { resolveStandaloneProfileDir } from "../../browser/standalone-profile.js";
import { reverseHost } from "../../browser/history-reader.js";
import type { ScreenMap } from "../../screens/screen-map.js";
import { discoverTool } from "../discover.js";

const DEMO_MAP = {
  $schema: "https://pwa-nav.local/schemas/screen-map.schema.json",
  schemaVersion: "1.0.0",
  app: {
    id: "testapp",
    name: "Test App",
    origin: "https://testapp.com",
    locale: "en",
    learnedAt: "2026-01-01T00:00:00.000Z",
  },
  screens: [
    {
      id: "root",
      route: "/",
      title: "Root",
      access: "public",
      fingerprint: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      observedAt: "2026-01-01T00:00:00.000Z",
      fields: [],
      actions: [],
      links: [],
      flows: [],
    },
  ],
};

function writePlacesDb(path: string, rows: readonly [string, string, number, number, string, number][]): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE moz_places (
      id INTEGER PRIMARY KEY,
      url TEXT,
      title TEXT,
      rev_host TEXT,
      visit_count INTEGER,
      hidden INTEGER,
      last_visit_date INTEGER
    )
  `);
  const insert = db.prepare(`
    INSERT INTO moz_places (url, title, rev_host, visit_count, hidden, last_visit_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const [url, title, visitCount, hidden, revHost, lastVisitDate] of rows) {
    insert.run(url, title, revHost, visitCount, hidden, lastVisitDate);
  }
  db.close();
}

test("discoverTool performs dry-run by default and persists to unmapped[] when write is true", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "pwa-nav-discover-tool-"));
  try {
    const target = resolveAppTarget("testapp.com");
    const profileDir = resolveStandaloneProfileDir(target.slug, cacheDir);
    await mkdir(profileDir, { recursive: true });

    // Place screen map
    const appDir = join(cacheDir, "apps", target.slug);
    await mkdir(appDir, { recursive: true });
    const mapPath = join(appDir, "screens.json");
    await writeFile(mapPath, JSON.stringify(DEMO_MAP, null, 2), "utf8");

    // Place places.sqlite
    const dbPath = join(profileDir, "places.sqlite");
    const revHost = reverseHost("testapp.com");
    writePlacesDb(dbPath, [
      ["https://testapp.com/", "Root", 10, 0, revHost, 100],
      ["https://testapp.com/candidate-one", "Candidate One", 5, 0, revHost, 200],
      ["https://testapp.com/items/99", "Item 99", 2, 0, revHost, 300],
    ]);

    // 1. Dry run
    const dryRunResult = await discoverTool({ app: "testapp.com" }, { cacheDir });
    assert.match(dryRunResult.text ?? "", /dry-run/);
    assert.match(dryRunResult.text ?? "", /\/candidate-one \(5 visits/);
    assert.match(dryRunResult.text ?? "", /\/items\/:id \(2 visits/);
    const dryRunStructured = dryRunResult.structured as { written: boolean; candidates: unknown[] };
    assert.equal(dryRunStructured.written, false);
    assert.equal(dryRunStructured.candidates.length, 2);

    // Verify map on disk unchanged
    const mapContentBefore = JSON.parse(await readFile(mapPath, "utf8")) as ScreenMap;
    assert.equal(mapContentBefore.unmapped, undefined);

    // 2. Write mode
    const writeResult = await discoverTool({ app: "testapp.com", write: true }, { cacheDir });
    assert.match(writeResult.text ?? "", /wrote 2 candidate route\(s\) into unmapped\[\]/);
    const writeStructured = writeResult.structured as { written: boolean };
    assert.equal(writeStructured.written, true);

    // Verify map on disk updated with history entries
    const mapContentAfter = JSON.parse(await readFile(mapPath, "utf8")) as ScreenMap;
    assert.ok(mapContentAfter.unmapped !== undefined);
    assert.equal(mapContentAfter.unmapped.length, 2);
    assert.equal(mapContentAfter.unmapped[0]?.reason, "history");

    // 3. Second run reports all covered
    const reRunResult = await discoverTool({ app: "testapp.com" }, { cacheDir });
    assert.match(reRunResult.text ?? "", /all visited history routes are already mapped or in unmapped\[\]/);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});
