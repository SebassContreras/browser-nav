import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  extractRootDomains,
  FirefoxCookieExtractor,
} from "../cookie-extractor.js";

describe("Cookie Extractor and Domain Matching", () => {
  describe("extractRootDomains", () => {
    it("extracts root and prefixed domains for standard hostnames and URLs", () => {
      // Arrange & Act
      const domains1 = extractRootDomains("https://www.linkedin.com/feed");
      const domains2 = extractRootDomains("notebook.google.com");
      const domains3 = extractRootDomains("mercadona.es");

      // Assert
      assert.ok(domains1.includes("linkedin.com"));
      assert.ok(domains1.includes(".linkedin.com"));

      assert.ok(domains2.includes("google.com"));
      assert.ok(domains2.includes(".google.com"));
      assert.ok(domains2.includes("notebook.google.com"));

      assert.ok(domains3.includes("mercadona.es"));
      assert.ok(domains3.includes(".mercadona.es"));
    });

    it("handles empty or invalid domain input gracefully", () => {
      assert.deepEqual(extractRootDomains(""), []);
      assert.deepEqual(extractRootDomains("   "), []);
    });
  });

  describe("FirefoxCookieExtractor", () => {
    it("returns empty array when cookies.sqlite does not exist", async () => {
      // Arrange
      const extractor = new FirefoxCookieExtractor();
      const nonExistentDir = join(tmpdir(), `non-existent-${String(Date.now())}`);

      // Act
      const cookies = await extractor.extractCookies({
        profileDir: nonExistentDir,
        targetDomains: ["google.com"],
      });

      // Assert
      assert.deepEqual(cookies, []);
    });

    it("extracts and filters valid unencrypted cookies matching domain from SQLite database", async () => {
      // Arrange
      const testDir = join(tmpdir(), `test-cookie-db-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(testDir, { recursive: true });

      const dbPath = join(testDir, "cookies.sqlite");
      const db = new DatabaseSync(dbPath);

      // Create standard Firefox moz_cookies schema
      db.exec(`
        CREATE TABLE moz_cookies (
          id INTEGER PRIMARY KEY,
          name TEXT,
          value TEXT,
          host TEXT,
          path TEXT,
          expiry INTEGER,
          lastAccessed INTEGER,
          creationTime INTEGER,
          isSecure INTEGER,
          isHttpOnly INTEGER,
          inBrowserElement INTEGER,
          sameSite INTEGER,
          rawSameSite INTEGER,
          schemeMap INTEGER
        );
      `);

      const futureExpiry = Math.floor(Date.now() / 1000) + 86400;
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;

      // Insert valid matching cookie
      db.prepare(`
        INSERT INTO moz_cookies (name, value, host, path, expiry, isSecure, isHttpOnly, sameSite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run("SID", "session123", ".google.com", "/", futureExpiry, 1, 1, 1);

      // Insert expired matching cookie
      db.prepare(`
        INSERT INTO moz_cookies (name, value, host, path, expiry, isSecure, isHttpOnly, sameSite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run("EXPIRED", "old123", ".google.com", "/", pastExpiry, 1, 1, 1);

      // Insert cookie from non-matching domain
      db.prepare(`
        INSERT INTO moz_cookies (name, value, host, path, expiry, isSecure, isHttpOnly, sameSite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run("OTHER", "unrelated", "unrelated-site.org", "/", futureExpiry, 0, 0, 0);

      db.close();

      try {
        const extractor = new FirefoxCookieExtractor();

        // Act
        const cookies = await extractor.extractCookies({
          profileDir: testDir,
          targetDomains: ["https://notebook.google.com"],
        });

        // Assert
        assert.equal(cookies.length, 1);
        assert.equal(cookies[0].name, "SID");
        assert.equal(cookies[0].value, "session123");
        assert.equal(cookies[0].domain, ".google.com");
        assert.equal(cookies[0].httpOnly, true);
        assert.equal(cookies[0].secure, true);
        assert.equal(cookies[0].sameSite, "lax");
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });
});
