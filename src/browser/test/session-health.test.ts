import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { PwaNavError } from "../../core/errors.js";
import { withProfileDb } from "../profile-db.js";
import { evaluateSessionHealth, expiryToMs } from "../session-health.js";
import { siteOf } from "../site.js";
import { readProfileCookies, type StoredCookie } from "../session-reader.js";

const NOW = Date.UTC(2026, 0, 1);

function writeCookieDb(path: string, rows: readonly [string, string, number][]): void {
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE moz_cookies (name TEXT, value TEXT, host TEXT, path TEXT, expiry INTEGER)");
  const insert = db.prepare("INSERT INTO moz_cookies VALUES (?, 'secret', ?, '/', ?)");
  for (const [name, host, expiry] of rows) insert.run(name, host, expiry);
  db.close();
}

async function hash(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

test("withProfileDb reads a copy, leaves the original untouched and removes its temp dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-health-"));
  try {
    const path = join(dir, "cookies.sqlite");
    writeCookieDb(path, [["sid", ".example.com", NOW / 1000 + 60]]);
    const before = await hash(path);

    const cookies = await readProfileCookies(dir);
    assert.deepEqual(cookies, [{ name: "sid", host: ".example.com", path: "/", expiry: NOW / 1000 + 60 }]);

    assert.equal(await hash(path), before);
    const copyPath = await withProfileDb(path, (db) => String(db.all("PRAGMA database_list")[0]?.["file"]));
    assert.ok(copyPath !== null && copyPath !== path);
    assert.equal(existsSync(dirname(copyPath)), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("withProfileDb returns null for a missing db and a structured error for an unreadable one", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-health-"));
  try {
    assert.equal(await readProfileCookies(dir), null);
    const path = join(dir, "cookies.sqlite");
    await writeFile(path, "not a database");
    await assert.rejects(
      withProfileDb(path, (db) => db.all("SELECT 1")),
      (err: unknown) => err instanceof PwaNavError && err.code === "session_busy",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("expiryToMs accepts both seconds and milliseconds", () => {
  assert.equal(expiryToMs(1_800_000_000), 1_800_000_000_000);
  assert.equal(expiryToMs(1_800_000_000_000), 1_800_000_000_000);
});

const cookie = (name: string, host: string, expiry: number): StoredCookie => ({ name, host, path: "/", expiry });

test("evaluateSessionHealth verdicts", () => {
  const opts = { host: "app.example.com", nowMs: NOW };
  assert.equal(evaluateSessionHealth(null, opts).verdict, "no_profile");
  assert.equal(evaluateSessionHealth([cookie("theme", ".example.com", NOW)], opts).verdict, "unauthenticated");
  assert.equal(evaluateSessionHealth([cookie("sid", ".other.com", NOW + 1e6)], opts).verdict, "unauthenticated");

  const expired = evaluateSessionHealth([cookie("sid", ".example.com", NOW / 1000 - 10)], opts);
  assert.equal(expired.verdict, "expired");
  assert.match(expired.hint ?? "", /Sign in again/);

  const ok = evaluateSessionHealth([cookie("sid", ".example.com", NOW + 3_600_000)], opts);
  assert.equal(ok.verdict, "authenticated");
  assert.equal(ok.ttlSeconds, 3600);
  assert.deepEqual(ok.cookies.map((c) => c.name), ["sid"]);
});

test("evaluateSessionHealth uses explicit cookie names instead of the heuristic", () => {
  const cookies = [cookie("sid", ".example.com", NOW + 1e6), cookie("custom", ".example.com", NOW + 1e6)];
  const health = evaluateSessionHealth(cookies, { host: "example.com", nowMs: NOW, authCookieNames: ["custom"] });
  assert.deepEqual(health.cookies.map((c) => c.name), ["custom"]);
});

test("siteOf groups hosts by registrable domain per the Public Suffix List", () => {
  assert.equal(siteOf(".www.linkedin.com"), "linkedin.com");
  assert.equal(siteOf("LinkedIn.com"), "linkedin.com");
  assert.equal(siteOf("login.mybank.co.uk"), "mybank.co.uk");
  assert.notEqual(siteOf("a.github.io"), siteOf("b.github.io"));
  assert.equal(siteOf("localhost"), "localhost");
});

test("evaluateSessionHealth counts a same-site subdomain session cookie found by the heuristic", () => {
  const health = evaluateSessionHealth(
    [cookie("li_at", ".www.linkedin.com", NOW + 3_600_000), cookie("li_at", ".evil.co.uk", NOW + 3_600_000)],
    { host: "linkedin.com", nowMs: NOW },
  );
  assert.equal(health.verdict, "authenticated");
  assert.deepEqual(health.cookies.map((c) => c.host), [".www.linkedin.com"]);
  const unrelated = evaluateSessionHealth([cookie("sid", ".other.co.uk", NOW + 1e6)], { host: "mybank.co.uk", nowMs: NOW });
  assert.equal(unrelated.verdict, "unauthenticated");
});
