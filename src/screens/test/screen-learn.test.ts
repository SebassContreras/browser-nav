import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { RawElement } from "../../browser/collector.js";
import {
  deriveIds,
  detectSensitive,
  inferParamName,
  isDynamicSegment,
  learnScreen,
  parameterizeRoute,
  screenIdFromRoute,
  slugify,
} from "../screen-learn.js";
import { validateScreenMap, type Screen, type ScreenMap } from "../screen-map.js";
import { assertValidRoutePattern } from "../screen-match.js";

const readJson = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8"));
const golden = readJson("checks/fixtures/login.golden.json") as RawElement[];
const demo = readJson("examples/screens/demo-app.screens.json") as ScreenMap;
const PAGE = { url: "http://localhost:8080/login?next=/x#y", title: "Demo App", appOrigin: "http://localhost:8080" };
const NOW = new Date("2026-10-01T10:40:36.789Z");

const el = (role: string, name: string, extra: Partial<RawElement> = {}): RawElement => ({
  role,
  name,
  nameSource: "content",
  occurrence: 0,
  ...extra,
});
const wrap = (screen: Screen): ScreenMap => ({
  schemaVersion: "1.0.0",
  app: { id: "t", name: "T", origin: "http://localhost:8080", locale: "en", learnedAt: "2026-10-01T10:40:36Z" },
  screens: [screen],
});

test("reproduces the committed demo login screen", async () => {
  const learned = learnScreen(golden, PAGE, { now: NOW, access: "public" });
  const expected = demo.screens[0];
  assert.ok(expected);
  assert.equal(learned.id, expected.id);
  assert.equal(learned.route, expected.route);
  assert.equal(learned.title, expected.title);
  assert.equal(learned.access, expected.access);
  assert.deepEqual(learned.fields, expected.fields);
  assert.deepEqual(learned.actions, expected.actions);
  assert.deepEqual(learned.links, expected.links);
  assert.equal(learned.fingerprint, expected.fingerprint);
  assert.equal(learned.observedAt, "2026-10-01T10:40:36Z");
  assert.deepEqual(learned.flows, []);
  assert.equal(learned.a11y, undefined);
  await validateScreenMap(wrap(learned));
});

test("submitNames overrides when the collector gives no buttonType", () => {
  const bare = golden.map((e) => {
    const copy = { ...e };
    delete copy.buttonType;
    return copy;
  });
  const without = learnScreen(bare, PAGE);
  assert.deepEqual(without.actions.map((a) => [a.id, a.kind, a.effect]), [
    ["show-password", "toggle", "ui-state"],
    ["sign-in", "button", "none"],
  ]);
  assert.equal(without.actions[1]?.requires, undefined);
  const withNames = learnScreen(bare, PAGE, { submitNames: new Set(["Sign in"]) });
  assert.equal(withNames.actions[1]?.kind, "submit");
  assert.deepEqual(withNames.actions[1].requires, ["email", "password"]);
});

test("slugify folds accents and symbols", () => {
  assert.equal(slugify("Contraseña"), "contrasena");
  assert.equal(slugify("  Iniciar sesión! "), "iniciar-sesion");
  assert.equal(slugify("Forgot password?"), "forgot-password");
  assert.equal(slugify("🔍"), "");
  assert.equal(slugify("---"), "");
});

test("screen id from route", () => {
  assert.equal(screenIdFromRoute("/login"), "login");
  assert.equal(screenIdFromRoute("/"), "home");
  assert.equal(screenIdFromRoute("/users/42/edit"), "users-42-edit");
  assert.equal(screenIdFromRoute("/日本"), "screen");
  assert.equal(learnScreen([], { ...PAGE, url: "http://localhost:8080/" }).id, "home");
  assert.equal(learnScreen([], PAGE, { screenId: "custom" }).id, "custom");
});

test("deriveIds: collisions, nameless, shared id space, reserved ids", () => {
  assert.deepEqual(
    deriveIds([
      { role: "button", name: "Save" },
      { role: "link", name: "Save" },
      { role: "button", name: "save" },
      { role: "button", name: "" },
      { role: "button", name: "🔍" },
      { role: "textbox", name: "" },
      { role: "button", name: "Save 2" },
    ]),
    ["save", "save-2", "save-3", "button-1", "button-2", "textbox-1", "save-2-2"],
  );
  assert.deepEqual(deriveIds([{ role: "button", name: "Save" }], new Set(["save"])), ["save-2"]);
});

test("detectSensitive table", () => {
  const cases: [Parameters<typeof detectSensitive>[0], boolean][] = [
    [{ name: "x", inputType: "password" }, true],
    [{ name: "x", autocomplete: "current-password" }, true],
    [{ name: "x", autocomplete: "section-a new-password" }, true],
    [{ name: "x", autocomplete: "ONE-TIME-CODE" }, true],
    [{ name: "Contraseña" }, true],
    [{ name: "Clave de acceso" }, true],
    [{ name: "API token" }, true],
    [{ name: "OTP code" }, true],
    [{ name: "Client secret" }, true],
    [{ name: "Email", inputType: "text", autocomplete: "username" }, false],
    [{ name: "Search" }, false],
    // Known false positives, accepted: the user just fills these by hand.
    [{ name: "Passenger name" }, true],
    [{ name: "Bypass filter" }, true],
  ];
  for (const [input, expected] of cases) {
    assert.equal(detectSensitive(input), expected, JSON.stringify(input));
  }
});

test("sensitive fields are never agent-fillable", () => {
  const s = learnScreen([el("textbox", "Contraseña", { inputType: "text" }), el("textbox", "City")], PAGE);
  assert.deepEqual(s.fields.map((f) => [f.id, f.sensitive, f.agentFillable]), [
    ["contrasena", true, false],
    ["city", false, true],
  ]);
});

test("links: internal as written, external origin only, unusable skipped", () => {
  const s = learnScreen(
    [
      el("link", "Rel", { href: "../a/b?x=1" }),
      el("link", "Abs", { href: "http://localhost:8080/c#frag" }),
      el("link", "Out", { href: "https://other.example:9000/p/q?r=1#h" }),
      el("link", "Port", { href: "http://localhost:9090/x" }),
      el("link", "Mail", { href: "mailto:a@b.c" }),
      el("link", "NoHref"),
    ],
    PAGE,
  );
  assert.deepEqual(s.links.map((l) => [l.id, l.href, l.external]), [
    ["rel", "../a/b?x=1", false],
    ["abs", "http://localhost:8080/c#frag", false],
    ["out", "https://other.example:9000", true],
    ["port", "http://localhost:9090", true],
  ]);
});

test("ignored roles", () => {
  const s = learnScreen([el("heading", "Title"), el("img", "Logo"), el("menuitemcheckbox", "M"), el("tab", "Tab A")], PAGE);
  assert.equal(s.fields.length + s.links.length, 0);
  assert.deepEqual(s.actions.map((a) => a.id), ["tab-a"]);
});

test("a11y findings", async () => {
  const s = learnScreen(
    [
      el("textbox", "Search docs", { nameSource: "placeholder", inputType: "text" }),
      el("button", ""),
      el("button", "Go"),
      el("button", "Go", { occurrence: 1 }),
    ],
    PAGE,
  );
  assert.deepEqual(s.a11y, [
    { code: "name-from-placeholder-only", target: "@search-docs", detail: '"Search docs" comes from the placeholder only; add a label', wcag: "3.3.2" },
    { code: "missing-accessible-name", target: "@button-1", detail: "button has no accessible name", wcag: "4.1.2" },
    { code: "duplicate-name", target: "@go-2", detail: "same role and name as @go" },
  ]);
  await validateScreenMap(wrap(s));
});

test("checkboxes are not required by submit; deterministic; input not mutated", () => {
  const input = [
    el("textbox", "User", { inputType: "text" }),
    el("checkbox", "Remember me"),
    el("button", "Go", { buttonType: "submit" }),
  ];
  const frozen = structuredClone(input);
  Object.freeze(input);
  input.forEach((e) => Object.freeze(e));
  const a = learnScreen(input, PAGE, { now: NOW });
  const b = learnScreen(input, PAGE, { now: NOW });
  assert.deepEqual(a, b);
  assert.deepEqual(input, frozen);
  assert.deepEqual(a.actions[0]?.requires, ["user"]);
});

test("isDynamicSegment detects UUIDs, base64 tokens, numeric IDs >= 4 digits, and hex hashes >= 8 chars", () => {
  assert.equal(isDynamicSegment("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isDynamicSegment("2-ZjhmMGE2NDUtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3"), true);
  assert.equal(isDynamicSegment("ZXlKaGJHY2lPaUpTVXpVMg=="), true);
  assert.equal(isDynamicSegment("104857"), true);
  assert.equal(isDynamicSegment("a1b2c3d4"), true);
  assert.equal(isDynamicSegment("deadbeef01234567"), true);

  assert.equal(isDynamicSegment("login"), false);
  assert.equal(isDynamicSegment("forgot-password"), false);
  assert.equal(isDynamicSegment("v1"), false);
  assert.equal(isDynamicSegment("42"), false);
  assert.equal(isDynamicSegment(":threadId"), false);
});

test("inferParamName derives deterministic semantic names from preceding segments and falls back to id or paramN", () => {
  assert.equal(inferParamName("thread"), "threadId");
  assert.equal(inferParamName("threads"), "threadId");
  assert.equal(inferParamName("categories"), "categoryId");
  assert.equal(inferParamName("boxes"), "boxId");
  assert.equal(inferParamName("user-profiles"), "userProfileId");
  assert.equal(inferParamName("status"), "statusId");

  assert.equal(inferParamName(undefined), "id");
  assert.equal(inferParamName(":threadId", new Set(["threadId"])), "id");
  assert.equal(inferParamName(undefined, new Set(["id"])), "param2");
  assert.equal(inferParamName(undefined, new Set(["id", "param2"])), "param3");
  assert.equal(inferParamName("threads", new Set(["threadId"])), "threadId2");
});

test("parameterizeRoute converts dynamic URL segments into valid route patterns", () => {
  const linkedInRoute = parameterizeRoute("/messaging/thread/2-ZjhmMGE2NDUtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3/");
  assert.equal(linkedInRoute, "/messaging/thread/:threadId");
  assert.doesNotThrow(() => { assertValidRoutePattern(linkedInRoute); });

  const nestedRoute = parameterizeRoute("/orgs/987654/projects/550e8400-e29b-41d4-a716-446655440000/commits/a1b2c3d4e5f6");
  assert.equal(nestedRoute, "/orgs/:orgId/projects/:projectId/commits/:commitId");
  assert.doesNotThrow(() => { assertValidRoutePattern(nestedRoute); });

  const fallbackRoute = parameterizeRoute("/550e8400-e29b-41d4-a716-446655440000/98765432");
  assert.equal(fallbackRoute, "/:id/:param2");
  assert.doesNotThrow(() => { assertValidRoutePattern(fallbackRoute); });
});

test("learnScreen automatically parameterizes dynamic URLs and derives clean screen IDs", async () => {
  const learned = learnScreen(
    [el("textbox", "Write a message", { nameSource: "placeholder", inputType: "text" }), el("button", "Send", { buttonType: "submit" })],
    {
      url: "https://www.linkedin.com/messaging/thread/2-ZjhmMGE2NDUtMTIzNC01Njc4LTkwYWItY2RlZjAxMjM0NTY3/",
      title: "Messaging | LinkedIn",
      appOrigin: "https://www.linkedin.com",
    },
    { now: NOW, access: "authenticated" },
  );

  assert.equal(learned.route, "/messaging/thread/:threadId");
  assert.equal(learned.id, "messaging-thread-threadid");
  await validateScreenMap({
    schemaVersion: "1.0.0",
    app: { id: "linkedin-com", name: "LinkedIn", origin: "https://www.linkedin.com", locale: "en", learnedAt: "2026-10-01T10:40:36Z" },
    screens: [learned],
  });
});
