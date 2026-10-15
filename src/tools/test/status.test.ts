import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { resolveAppTarget } from "../../backend/backend.js";
import { resolveStandaloneProfileDir } from "../../browser/standalone-profile.js";
import { statusTool } from "../status.js";

test("statusTool reports the verdict, cookie names and sign-in hint from the stored profile", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "pwa-nav-status-"));
  try {
    const missing = await statusTool({ app: "example.com" }, { cacheDir, nowMs: 0 });
    assert.equal((missing.structured as { verdict: string }).verdict, "no_profile");

    const profileDir = resolveStandaloneProfileDir(resolveAppTarget("example.com").slug, cacheDir);
    await mkdir(profileDir, { recursive: true });
    const db = new DatabaseSync(join(profileDir, "cookies.sqlite"));
    db.exec("CREATE TABLE moz_cookies (name TEXT, host TEXT, path TEXT, expiry INTEGER)");
    db.exec("INSERT INTO moz_cookies VALUES ('sid', '.example.com', '/', 7200)");
    db.close();

    const ok = await statusTool({ app: "example.com" }, { cacheDir, nowMs: 0 });
    assert.match(ok.text, /: authenticated \(expires in 2h\)\ncookies: sid$/);
    const expired = await statusTool({ app: "example.com" }, { cacheDir, nowMs: 10_000_000 });
    assert.match(expired.text, /expired[\s\S]*hint: .*pwa-nav auth example\.com/);
    await assert.rejects(statusTool({}), /status needs an app/);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});
