import assert from "node:assert/strict";
import { test } from "node:test";
import { StaleRefError } from "../../core/refs.js";
import type { Snapshot } from "../../core/snapshot.js";
import type { RawElement } from "../collector.js";
import { assertFresh, findByLocator, sameDocumentUrl } from "../locate.js";

const el = (role: string, name: string, occurrence = 0): RawElement => ({ role, name, nameSource: "content", occurrence });
const raw = [el("button", "Go"), el("link", "Go"), el("button", "Go", 1)];
const snapshot: Snapshot = { snapshotId: "s1", url: "https://x.test/a#top", title: "t", elements: [] };

test("findByLocator picks nth occurrence", () => {
  assert.equal(findByLocator(raw, { role: "button", name: "Go" })?.index, 0);
  assert.equal(findByLocator(raw, { role: "button", name: "Go", occurrence: 1 })?.index, 2);
  assert.equal(findByLocator(raw, { role: "button", name: "Go", occurrence: 2 }), null);
  assert.equal(findByLocator(raw, { role: "button", name: "go" }), null);
});

test("sameDocumentUrl ignores fragment, rejects invalid", () => {
  assert.equal(sameDocumentUrl("https://x.test/a#1", "https://x.test/a#2"), true);
  assert.equal(sameDocumentUrl("https://x.test/a", "https://x.test/b"), false);
  assert.equal(sameDocumentUrl("nope", "nope"), false);
});

test("sameDocumentUrl table-driven query string and path partitions", () => {
  interface UrlTestCase {
    name: string;
    urlA: string;
    urlB: string;
    expected: boolean;
  }

  const cases: UrlTestCase[] = [
    {
      name: "stripped query parameters by client-side router",
      urlA: "https://x.test/jobs/view/123?refId=abc&trackingId=def",
      urlB: "https://x.test/jobs/view/123",
      expected: true,
    },
    {
      name: "added query parameters by SPA tracking",
      urlA: "https://x.test/dashboard",
      urlB: "https://x.test/dashboard?utm_source=nav&session=xyz",
      expected: true,
    },
    {
      name: "reordered query parameters",
      urlA: "https://x.test/search?q=engineer&loc=remote",
      urlB: "https://x.test/search?loc=remote&q=engineer",
      expected: true,
    },
    {
      name: "fragment change combined with query change",
      urlA: "https://x.test/page?tab=1#section1",
      urlB: "https://x.test/page?tab=2#section2",
      expected: true,
    },
    {
      name: "pathname changes to different route",
      urlA: "https://x.test/jobs/view/123",
      urlB: "https://x.test/jobs/view/456",
      expected: false,
    },
    {
      name: "origin changes",
      urlA: "https://auth.x.test/login",
      urlB: "https://app.x.test/login",
      expected: false,
    },
    {
      name: "empty string URL input",
      urlA: "",
      urlB: "https://x.test/a",
      expected: false,
    },
    {
      name: "both invalid URL strings",
      urlA: "not-a-url",
      urlB: "not-a-url",
      expected: false,
    },
  ];

  for (const tc of cases) {
    const actual = sameDocumentUrl(tc.urlA, tc.urlB);
    assert.equal(actual, tc.expected, `${tc.name} result mismatch`);
  }
});

function stale(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof StaleRefError);
    assert.match(e.message, /Re-snapshot to get a fresh snapshotId \+ ref\./);
    return e.message;
  }
  throw new Error("expected StaleRefError");
}

test("assertFresh ok and failures", () => {
  const live = { url: "https://x.test/a#other", raw };
  assert.equal(assertFresh({ snapshot, locator: { role: "link", name: "Go", occurrence: 0 }, live }).index, 1);
  assert.match(
    stale(() => assertFresh({ snapshot, locator: { role: "link", name: "Go" }, live: { ...live, url: "https://x.test/b" } })),
    /"https:\/\/x\.test\/a#top".*"https:\/\/x\.test\/b"/,
  );
  assert.match(
    stale(() => assertFresh({ snapshot, locator: { role: "tab", name: "Z" }, live })),
    /no element with role "tab" and name "Z"/,
  );
  assert.match(
    stale(() => assertFresh({ snapshot, locator: { role: "link", name: "Go", occurrence: 3 }, live })),
    /only 1 element\(s\) with role "link" and name "Go", occurrence 3 requested/,
  );
});
