import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDiscovery,
  discoverRoutes,
  generalisePathname,
} from "../screen-discover.js";
import type { ScreenMap } from "../screen-map.js";
import type { StoredHistoryEntry } from "../../browser/history-reader.js";

const BASE_MAP: ScreenMap = {
  schemaVersion: "1.0.0",
  app: {
    id: "test-app",
    name: "Test App",
    origin: "https://example.com",
    locale: "en",
    learnedAt: "2026-01-01T00:00:00.000Z",
  },
  screens: [
    {
      id: "home",
      route: "/",
      title: "Home",
      access: "public",
      fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      observedAt: "2026-01-01T00:00:00.000Z",
      fields: [],
      actions: [],
      links: [],
      flows: [],
    },
    {
      id: "existing-profile",
      route: "/profile/:id",
      title: "Profile",
      access: "authenticated",
      fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      observedAt: "2026-01-01T00:00:00.000Z",
      fields: [],
      actions: [],
      links: [],
      flows: [],
    },
  ],
  unmapped: [
    {
      route: "/already-unmapped",
      reason: "link-only",
      note: "Seen before",
    },
  ],
};

test("generalisePathname handles numeric, uuid, and hex/opaque tokens with deduplicated param names", () => {
  assert.equal(generalisePathname("/"), "/");
  assert.equal(generalisePathname("/settings/account"), "/settings/account");
  assert.equal(generalisePathname("/users/123"), "/users/:id");
  assert.equal(generalisePathname("/users/123/posts/456"), "/users/:id/posts/:id2");
  assert.equal(
    generalisePathname("/items/123e4567-e89b-12d3-a456-426614174000"),
    "/items/:uuid",
  );
  assert.equal(
    generalisePathname("/token/a1b2c3d4e5f6g7h81234"),
    "/token/:token",
  );
  assert.equal(
    generalisePathname("/multi/123e4567-e89b-12d3-a456-426614174000/and/987f6543-e21b-12d3-a456-426614174999"),
    "/multi/:uuid/and/:uuid2",
  );
});

test("discoverRoutes groups visits, filters covered routes and unmapped routes, and caps results", () => {
  const entries: StoredHistoryEntry[] = [
    // Already covered by existing screen (route: /)
    { url: "https://example.com/", title: "Home", visitCount: 10, lastVisitDate: 100 },
    // Already covered by existing screen (route: /profile/:id)
    { url: "https://example.com/profile/999", title: "My Profile", visitCount: 5, lastVisitDate: 200 },
    // Already in unmapped[] (/already-unmapped)
    { url: "https://example.com/already-unmapped", title: "Unmapped", visitCount: 2, lastVisitDate: 300 },
    // Candidate 1: /products/100 and /products/101 group under /products/:id
    { url: "https://example.com/products/100", title: "Product 100", visitCount: 4, lastVisitDate: 400 },
    { url: "https://example.com/products/101", title: "Product 101", visitCount: 6, lastVisitDate: 500 },
    // Candidate 2: /about
    { url: "https://example.com/about", title: "About Us", visitCount: 3, lastVisitDate: 350 },
  ];

  const candidates = discoverRoutes(entries, BASE_MAP);
  assert.equal(candidates.length, 2);

  // /products/:id should have 10 visits, latest date 500, title "Product 101"
  const productCandidate = candidates[0];
  assert.ok(productCandidate !== undefined);
  assert.equal(productCandidate.route, "/products/:id");
  assert.equal(productCandidate.visitCount, 10);
  assert.equal(productCandidate.lastVisitDate, 500);
  assert.equal(productCandidate.lastTitle, "Product 101");

  const aboutCandidate = candidates[1];
  assert.ok(aboutCandidate !== undefined);
  assert.equal(aboutCandidate.route, "/about");
  assert.equal(aboutCandidate.visitCount, 3);
});

test("applyDiscovery creates a new ScreenMap with enriched unmapped[] without mutating original", () => {
  const candidates = [
    {
      route: "/new-route/:id",
      visitCount: 12,
      lastVisitDate: 1700000000000000,
      lastTitle: "Item Detail",
    },
  ];

  const updated = applyDiscovery(BASE_MAP, candidates);
  assert.notEqual(updated, BASE_MAP);
  assert.ok(BASE_MAP.unmapped !== undefined);
  assert.equal(BASE_MAP.unmapped.length, 1);
  assert.ok(updated.unmapped !== undefined);
  assert.equal(updated.unmapped.length, 2);

  const added = updated.unmapped.find((u) => u.route === "/new-route/:id");
  assert.ok(added !== undefined);
  assert.equal(added.reason, "history");
  assert.match(added.note ?? "", /12 visits/);
  assert.match(added.note ?? "", /Item Detail/);
});
