import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { readProfileHistory, reverseHost } from "../history-reader.js";

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

test("reverseHost formats hostnames correctly for moz_places", () => {
  assert.equal(reverseHost("example.com"), "moc.elpmaxe.");
  assert.equal(reverseHost("www.example.com"), "moc.elpmaxe.www.");
  assert.equal(reverseHost("localhost"), "tsohlacol.");
});

test("readProfileHistory reads visited entries matching origin and excludes hidden/zero-visit rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-places-"));
  try {
    const dbPath = join(dir, "places.sqlite");
    const targetOrigin = "https://example.com";
    const revHost = reverseHost("example.com");

    writePlacesDb(dbPath, [
      // Valid entry 1
      ["https://example.com/feed", "Feed Title", 5, 0, revHost, 1700000000000],
      // Valid entry 2
      ["https://example.com/profile/123", "Profile", 1, 0, revHost, 1700000001000],
      // Hidden entry (should be excluded)
      ["https://example.com/hidden", "Hidden", 2, 1, revHost, 1700000002000],
      // Zero visit count (should be excluded)
      ["https://example.com/zero", "Zero", 0, 0, revHost, 1700000003000],
      // Different port/origin (should be excluded by exact origin check)
      ["https://example.com:8443/custom", "Custom Port", 3, 0, revHost, 1700000004000],
      // Different rev_host (should be excluded by SQL query)
      ["https://other.com/page", "Other", 4, 0, reverseHost("other.com"), 1700000005000],
    ]);

    const results = await readProfileHistory(dir, targetOrigin);
    assert.ok(results !== null);
    assert.equal(results.length, 2);
    assert.deepEqual(
      results.map((r) => r.url).sort(),
      ["https://example.com/feed", "https://example.com/profile/123"],
    );
    const feed = results.find((r) => r.url === "https://example.com/feed");
    assert.ok(feed !== undefined);
    assert.equal(feed.title, "Feed Title");
    assert.equal(feed.visitCount, 5);
    assert.equal(feed.lastVisitDate, 1700000000000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readProfileHistory returns null when places.sqlite does not exist", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-places-"));
  try {
    const results = await readProfileHistory(dir, "https://example.com");
    assert.equal(results, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
