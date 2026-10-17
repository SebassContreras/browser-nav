import assert from "node:assert/strict";
import { test } from "node:test";
import { PERFORMANCE_PREFS } from "../performance-prefs.js";
import {
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  mergeUserJs,
  serializeUserJs,
} from "../user-js.js";

test("serializeUserJs formats preferences correctly", () => {
  const content = serializeUserJs({
    "test.bool": true,
    "test.num": 42,
    "test.str": "hello",
  });
  assert.equal(
    content,
    'user_pref("test.bool", true);\nuser_pref("test.num", 42);\nuser_pref("test.str", "hello");\n',
  );
});

test("mergeUserJs with empty existing content produces a valid managed block", () => {
  const managed = { "pref.a": true };
  const res = mergeUserJs("", managed);
  assert.equal(
    res,
    `${MANAGED_BLOCK_START}\nuser_pref("pref.a", true);\n${MANAGED_BLOCK_END}\n`,
  );
});

test("mergeUserJs preserves user lines before and after managed block byte-for-byte (R4)", () => {
  const existing = `// Custom user header comment\nuser_pref("user.custom", 123);\n\n${MANAGED_BLOCK_START}\nuser_pref("old.pref", false);\n${MANAGED_BLOCK_END}\n// Custom user footer comment\n`;
  const managed = { "new.pref": true };
  const res = mergeUserJs(existing, managed);

  assert.ok(res.startsWith(`// Custom user header comment\nuser_pref("user.custom", 123);\n\n`));
  assert.ok(res.endsWith(`// Custom user footer comment\n`));
  assert.ok(res.includes(`${MANAGED_BLOCK_START}\nuser_pref("new.pref", true);\n${MANAGED_BLOCK_END}`));
});

test("mergeUserJs: user override wins over managed pref by omitting it from managed block (R4)", () => {
  const existing = `user_pref("general.smoothScroll", true);\n${MANAGED_BLOCK_START}\n${MANAGED_BLOCK_END}\n`;
  const managed = {
    "general.smoothScroll": false,
    "network.dns.disablePrefetch": true,
  };
  const res = mergeUserJs(existing, managed);

  // user's smoothScroll remains outside, and is NOT in the managed block
  const block = res.slice(res.indexOf(MANAGED_BLOCK_START), res.indexOf(MANAGED_BLOCK_END));
  assert.ok(!block.includes("general.smoothScroll"));
  assert.ok(block.includes('user_pref("network.dns.disablePrefetch", true);'));
});

test("mergeUserJs: unoverridable keys remain in managed block even if overridden outside (D3)", () => {
  const existing = `user_pref("remote.active-protocols", 0);\n${MANAGED_BLOCK_START}\n${MANAGED_BLOCK_END}\n`;
  const managed = {
    "remote.active-protocols": 1,
    "other.pref": true,
  };
  const res = mergeUserJs(existing, managed, {
    unoverridableKeys: new Set(["remote.active-protocols"]),
  });

  const block = res.slice(res.indexOf(MANAGED_BLOCK_START), res.indexOf(MANAGED_BLOCK_END));
  assert.ok(block.includes('user_pref("remote.active-protocols", 1);'));
});

test("mergeUserJs is idempotent across successive runs", () => {
  const managed = { "pref.x": 1 };
  const initial = `user_pref("user.p", "abc");\n${MANAGED_BLOCK_START}\n${MANAGED_BLOCK_END}\n`;
  const first = mergeUserJs(initial, managed);
  const second = mergeUserJs(first, managed);
  assert.equal(first, second);
});

test("mergeUserJs treats legacy file without markers as fully managed (D2)", () => {
  const legacy = `user_pref("remote.active-protocols", 1);\nuser_pref("browser.shell.checkDefaultBrowser", false);\n`;
  const managed = { "remote.active-protocols": 1, "new.pref": true };
  const res = mergeUserJs(legacy, managed);

  assert.equal(
    res,
    `${MANAGED_BLOCK_START}\nuser_pref("remote.active-protocols", 1);\nuser_pref("new.pref", true);\n${MANAGED_BLOCK_END}\n`,
  );
});

test("PERFORMANCE_PREFS catalog pins expected preference names (D1, R1, R2)", () => {
  // Deterministic settling
  assert.equal(PERFORMANCE_PREFS["general.smoothScroll"], false);
  assert.equal(PERFORMANCE_PREFS["toolkit.cosmeticAnimations.enabled"], false);
  assert.equal(PERFORMANCE_PREFS["ui.prefersReducedMotion"], 1);

  // Speculative network noise
  assert.equal(PERFORMANCE_PREFS["network.dns.disablePrefetch"], true);
  assert.equal(PERFORMANCE_PREFS["network.prefetch-next"], false);
  assert.equal(PERFORMANCE_PREFS["network.http.speculative-parallel-limit"], 0);
  assert.equal(PERFORMANCE_PREFS["network.predictor.enabled"], false);
  assert.equal(PERFORMANCE_PREFS["browser.urlbar.speculativeConnect.enabled"], false);
  assert.equal(PERFORMANCE_PREFS["browser.places.speculativeConnect.enabled"], false);

  // Background work
  assert.equal(PERFORMANCE_PREFS["browser.pagethumbnails.capturing_disabled"], true);
  assert.equal(PERFORMANCE_PREFS["app.normandy.enabled"], false);
  assert.equal(PERFORMANCE_PREFS["browser.ping-centre.telemetry"], false);
});

test("PERFORMANCE_PREFS never touches startupCache (R3)", () => {
  for (const key of Object.keys(PERFORMANCE_PREFS)) {
    assert.ok(!key.toLowerCase().includes("startupcache"), `Pref ${key} touches startup cache`);
  }
});
