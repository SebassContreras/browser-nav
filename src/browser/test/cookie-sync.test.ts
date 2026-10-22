import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { CookieSyncService, type BiDiStorageClient } from "../cookie-sync.js";
import type { ExtractedCookie } from "../cookie-extractor.js";

describe("CookieSyncService", () => {
  it("seeds cookies into a target profile SQLite database", async () => {
    // Arrange
    const testDir = join(tmpdir(), `test-sync-db-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    const cookies: ExtractedCookie[] = [
      {
        name: "LI_AT",
        value: "linkedin_token_abc",
        domain: ".linkedin.com",
        path: "/",
        expiry: Math.floor(Date.now() / 1000) + 3600,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      },
      {
        name: "JSESSIONID",
        value: "ajax:12345",
        domain: "www.linkedin.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "none",
      },
    ];

    try {
      const service = new CookieSyncService();

      // Act
      const result = await service.sync({
        cookies,
        targetProfileDir: testDir,
      });

      // Assert
      assert.equal(result.syncedCount, 2);
      assert.equal(result.seededIntoProfile, true);
      assert.equal(result.injectedViaBiDi, false);

      // Verify records in database
      const dbPath = join(testDir, "cookies.sqlite");
      const db = new DatabaseSync(dbPath, { readOnly: true });
      interface CookieRow {
        name: string;
        value: string;
        host: string;
        isSecure: number;
        isHttpOnly: number;
        sameSite: number;
      }
      const rows = db.prepare("SELECT name, value, host, isSecure, isHttpOnly, sameSite FROM moz_cookies").all() as unknown as CookieRow[];
      db.close();

      assert.equal(rows.length, 2);
      assert.equal(rows[0].name, "LI_AT");
      assert.equal(rows[0].value, "linkedin_token_abc");
      assert.equal(rows[0].host, ".linkedin.com");
      assert.equal(rows[0].isSecure, 1);
      assert.equal(rows[0].isHttpOnly, 1);
      assert.equal(rows[0].sameSite, 1); // lax = 1
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("injects cookies via WebDriver BiDi storage.setCookie when bidiClient is provided", async () => {
    // Arrange
    const sentCalls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const mockBiDiClient: BiDiStorageClient = {
      send(method: string, params: Record<string, unknown>): Promise<unknown> {
        sentCalls.push({ method, params });
        return Promise.resolve({ partitionKey: {} });
      },
    };

    const cookies: ExtractedCookie[] = [
      {
        name: "SID",
        value: "google_sid_value",
        domain: ".google.com",
        path: "/",
        expiry: Math.floor(Date.now() / 1000) + 7200,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      },
    ];

    const service = new CookieSyncService();

    // Act
    const result = await service.sync({
      cookies,
      bidiClient: mockBiDiClient,
      sourceOrigin: "https://notebook.google.com",
    });

    // Assert
    assert.equal(result.syncedCount, 1);
    assert.equal(result.injectedViaBiDi, true);
    assert.equal(result.seededIntoProfile, false);

    assert.equal(sentCalls.length, 1);
    assert.equal(sentCalls[0].method, "storage.setCookie");
    const cookieParam = sentCalls[0].params.cookie as Record<string, unknown>;
    assert.equal(cookieParam.name, "SID");
    assert.deepEqual(cookieParam.value, { type: "string", value: "google_sid_value" });
    assert.equal(cookieParam.domain, ".google.com");
    assert.equal(cookieParam.secure, true);
    assert.equal(cookieParam.httpOnly, true);
    assert.equal(cookieParam.sameSite, "lax");

    const partition = sentCalls[0].params.partition as Record<string, unknown>;
    assert.equal(partition.type, "storageKey");
    assert.equal(partition.sourceOrigin, "https://notebook.google.com");
  });
});
