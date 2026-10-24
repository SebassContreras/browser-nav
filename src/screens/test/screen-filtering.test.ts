// Spec 001-screen-map-filtering: user content stays out of screens.json, live snapshots keep it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { collectInteractive, type RawElement } from "../../browser/collector.js";
import { buildLiveSnapshot } from "../../browser/live-snapshot.js";
import { findByLocator } from "../../browser/locate.js";
import {
  isAnonymousListCheckbox,
  isConversationItemControl,
  isQuickReactionControl,
  isUserContentExternalLink,
  learnScreen,
  scrubMutableBadgeCounts,
} from "../screen-learn.js";
import { mergeScreen } from "../screen-merge.js";
import { refFor, resolveTarget } from "../screen-resolve.js";
import type { Screen } from "../screen-map.js";

const html = readFileSync(new URL("../../../checks/fixtures/chat.html", import.meta.url), "utf8");
const raw: RawElement[] = collectInteractive(new JSDOM(html).window.document);
const PAGE = { url: "http://localhost:8080/chat", title: "Chat", appOrigin: "http://localhost:8080" };
const NOW = new Date("2026-10-08T10:00:00Z");
const learned = learnScreen(raw, PAGE, { now: NOW });

const persistedNames = (screen: Screen): string[] =>
  [...screen.fields, ...screen.actions, ...screen.links].map((e) => e.name);

const CONTENT = [
  "Hey, are we still meeting tomorrow at noon?",
  "Reaction 👍 1",
  "View reactions",
  "Quoted message: are we still meeting",
  "Yes, see you at the usual place!",
  "Fede",
  "Thanks, that works perfectly for me.",
  "Reacción ❤️",
];

test("chat fixture persists only patterns for message content (R1, R2, R3, R5)", () => {
  const names = persistedNames(learned);
  for (const name of CONTENT) assert.ok(!names.includes(name), `persisted: ${name}`);
  const patterns = learned.patterns ?? [];
  assert.deepEqual(
    patterns.map((p) => [p.containerRole, p.itemRole, p.dynamicChildren]),
    [["log", "button", true], ["log", "link", true]],
  );
  for (const p of patterns) assert.equal(p.containerName, "Conversation with Fede");
});

test("live snapshot still lists and resolves every excluded element (R4, D5)", () => {
  const { snapshot, locators } = buildLiveSnapshot(raw, { url: PAGE.url, title: PAGE.title }, { snapshotId: "s1" });
  for (const name of CONTENT) {
    const element = snapshot.elements.find((e) => e.name === name);
    assert.ok(element, `missing from snapshot: ${name}`);
    const locator = locators[element.ref];
    assert.ok(locator);
    assert.equal(findByLocator(raw, locator)?.element.name, name);
  }
});

test("chrome controls are persisted exactly as without the content (R6)", () => {
  const chromeOnly = raw.filter((e) => !CONTENT.includes(e.name));
  const baseline = learnScreen(chromeOnly, PAGE, { now: NOW });
  assert.deepEqual(learned.fields, baseline.fields);
  assert.deepEqual(learned.actions, baseline.actions);
  assert.deepEqual(learned.links, baseline.links);
  assert.deepEqual(learned.links.map((l) => l.id), ["sign-in"]);
  assert.deepEqual(learned.fields.map((f) => f.id), ["search", "message"]);
  assert.deepEqual(learned.actions.map((a) => a.id), ["attach-file", "send"]);
});

test("re-learning a polluted screen keeps junk without prune, removes it with prune (R5, R7)", () => {
  const junk = { id: "view-reactions", role: "button", name: "View reactions", nameSource: "content" as const, kind: "button" as const, effect: "none" as const, locator: { role: "button", name: "View reactions", occurrence: 0 } };
  const polluted: Screen = { ...learned, actions: [...learned.actions, junk] };
  delete polluted.patterns;

  const kept = mergeScreen(polluted, learned, { now: NOW }).screen;
  assert.ok(kept.actions.some((a) => a.id === "view-reactions"));
  assert.deepEqual(kept.patterns, learned.patterns);

  const pruned = mergeScreen(polluted, learned, { now: NOW, prune: true }).screen;
  assert.ok(!pruned.actions.some((a) => a.id === "view-reactions"));
  assert.deepEqual(pruned.patterns, learned.patterns);
  assert.deepEqual(pruned.actions.map((a) => a.id), learned.actions.map((a) => a.id));
});

test("anonymous and generic checkboxes in lists/feeds are excluded while named form checkboxes are kept (R1)", () => {
  // Given anonymous and generic checkboxes alongside named form checkboxes
  assert.equal(isAnonymousListCheckbox({ role: "checkbox", name: "" }), true);
  assert.equal(isAnonymousListCheckbox({ role: "switch", name: "" }), true);
  assert.equal(isAnonymousListCheckbox({ role: "checkbox", name: "Seleccionar", containerRole: "list" }), true);
  assert.equal(isAnonymousListCheckbox({ role: "checkbox", name: "Select row", containerRole: "grid" }), true);
  assert.equal(isAnonymousListCheckbox({ role: "checkbox", name: "Remember me" }), false);
  assert.equal(isAnonymousListCheckbox({ role: "checkbox", name: "Solicitud sencilla", containerRole: "region" }), false);

  const elements: RawElement[] = [
    { role: "checkbox", name: "", nameSource: "content", occurrence: 0, inputType: "checkbox", containerRole: "list", containerName: "Messages" },
    { role: "checkbox", name: "", nameSource: "content", occurrence: 1, inputType: "checkbox" },
    { role: "switch", name: "", nameSource: "content", occurrence: 0, inputType: "checkbox" },
    { role: "checkbox", name: "Select", nameSource: "aria-label", occurrence: 0, inputType: "checkbox", containerRole: "grid", containerName: "Threads" },
    { role: "checkbox", name: "Remember me", nameSource: "label", occurrence: 0, inputType: "checkbox" },
    { role: "button", name: "Save", nameSource: "content", occurrence: 0, buttonType: "submit" },
  ];

  // When learning the screen
  const screen = learnScreen(elements, PAGE, { now: NOW });

  // Then only the named form checkbox and submit button are persisted
  assert.deepEqual(screen.fields.map((f) => f.id), ["remember-me"]);
  assert.deepEqual(screen.actions.map((a) => a.id), ["save"]);
  assert.equal(screen.a11y, undefined);
});

test("quick-reaction buttons and emoji affirmations are excluded from permanent screen controls (R2)", () => {
  // Given reaction controls and legitimate application controls
  assert.equal(isQuickReactionControl({ role: "checkbox", name: "¡Felicidades! 🎉" }), true);
  assert.equal(isQuickReactionControl({ role: "checkbox", name: "🎉 Me alegro mucho por ti" }), true);
  assert.equal(isQuickReactionControl({ role: "button", name: "👍" }), true);
  assert.equal(isQuickReactionControl({ role: "button", name: "❤️ 3" }), true);
  assert.equal(isQuickReactionControl({ role: "button", name: "¡Gracias!" }), true);
  assert.equal(isQuickReactionControl({ role: "button", name: "Thumbs up" }), true);
  assert.equal(isQuickReactionControl({ role: "button", name: "Send message" }), false);
  assert.equal(isQuickReactionControl({ role: "button", name: "Redactar mensaje" }), false);

  const elements: RawElement[] = [
    { role: "checkbox", name: "¡Felicidades! 🎉", nameSource: "content", occurrence: 0 },
    { role: "checkbox", name: "🎉 Me alegro mucho por ti", nameSource: "content", occurrence: 0 },
    { role: "button", name: "👍", nameSource: "content", occurrence: 0 },
    { role: "button", name: "❤️", nameSource: "aria-label", occurrence: 0 },
    { role: "button", name: "Congratulations", nameSource: "content", occurrence: 0 },
    { role: "button", name: "Redactar mensaje", nameSource: "content", occurrence: 0 },
    { role: "textbox", name: "Escribe un mensaje", nameSource: "placeholder", occurrence: 0, inputType: "text" },
  ];

  // When learning the screen
  const screen = learnScreen(elements, PAGE, { now: NOW });

  // Then only structural controls are persisted
  assert.deepEqual(screen.fields.map((f) => f.id), ["escribe-un-mensaje"]);
  assert.deepEqual(screen.actions.map((a) => a.id), ["redactar-mensaje"]);
});

test("mutable badge and counter suffixes are scrubbed to produce stable semantic IDs and merge without zombie duplicates (R3)", () => {
  // Given accessible names with mutable notification counts and live reader metrics
  assert.equal(scrubMutableBadgeCounts("Notificaciones, 3 notificaciones nuevas"), "Notificaciones");
  assert.equal(scrubMutableBadgeCounts("Notificaciones, 1 notificación nueva"), "Notificaciones");
  assert.equal(scrubMutableBadgeCounts("Mensajes, 0 notificaciones nuevas"), "Mensajes");
  assert.equal(scrubMutableBadgeCounts("Mi red, 0 nuevas notificaciones"), "Mi red");
  assert.equal(scrubMutableBadgeCounts("Inicio, 1 nueva notificación"), "Inicio");
  assert.equal(scrubMutableBadgeCounts("Notifications, 5 new notifications"), "Notifications");
  assert.equal(scrubMutableBadgeCounts("Inbox (12 unread)"), "Inbox");
  assert.equal(
    scrubMutableBadgeCounts("Habrá motores de combustión en la UE más allá de 2035 Hace 3 horas • 377 lectores"),
    "Habrá motores de combustión en la UE más allá de 2035",
  );
  assert.equal(scrubMutableBadgeCounts("JOIN 220.548 seguidores"), "JOIN");
  assert.equal(scrubMutableBadgeCounts("Zip n.º 581 14 contactos han jugado"), "Zip n.º 581");

  const initialElements: RawElement[] = [
    { role: "button", name: "Inicio, 1 nueva notificación", nameSource: "aria-label", occurrence: 0 },
    { role: "link", name: "Notificaciones, 3 notificaciones nuevas", nameSource: "aria-label", occurrence: 0, href: "http://localhost:8080/notifications" },
    { role: "link", name: "Mensajes, 0 notificaciones nuevas", nameSource: "aria-label", occurrence: 0, href: "http://localhost:8080/messaging" },
  ];

  // When learning the screen initially
  const firstScreen = learnScreen(initialElements, PAGE, { now: NOW });

  // Then semantic IDs are clean and free of volatile numbers
  assert.deepEqual(firstScreen.actions.map((a) => a.id), ["inicio"]);
  assert.deepEqual(firstScreen.links.map((l) => l.id), ["notificaciones", "mensajes"]);

  // When badge counts change on a subsequent visit and the screen is re-learned
  const updatedElements: RawElement[] = [
    { role: "button", name: "Inicio, 0 nuevas notificaciones", nameSource: "aria-label", occurrence: 0 },
    { role: "link", name: "Notificaciones, 0 notificaciones nuevas", nameSource: "aria-label", occurrence: 0, href: "http://localhost:8080/notifications" },
    { role: "link", name: "Mensajes, 2 notificaciones nuevas", nameSource: "aria-label", occurrence: 0, href: "http://localhost:8080/messaging" },
  ];
  const secondLearned = learnScreen(updatedElements, PAGE, { now: NOW });
  const merged = mergeScreen(firstScreen, secondLearned, { now: NOW });

  // Then existing IDs are preserved in place without adding zombie duplicates
  assert.equal(merged.diff.added.length, 0);
  assert.equal(merged.diff.missing.length, 0);
  assert.deepEqual(merged.screen.actions.map((a) => a.id), ["inicio"]);
  assert.deepEqual(merged.screen.links.map((l) => l.id), ["notificaciones", "mensajes"]);

  // And live locator resolution still finds @notificaciones even if the live count ticks up mid-session
  const liveTickElements: RawElement[] = [
    { role: "link", name: "Notificaciones, 7 notificaciones nuevas", nameSource: "aria-label", occurrence: 0, href: "http://localhost:8080/notifications" },
  ];
  const resolved = resolveTarget(firstScreen, { id: "notificaciones" }, "click");
  const { snapshot, locators } = buildLiveSnapshot(liveTickElements, { url: PAGE.url, title: PAGE.title }, { snapshotId: "s-badge" });
  const ref = refFor({ snapshotId: snapshot.snapshotId, url: snapshot.url, locators }, resolved.locator, resolved, snapshot.snapshotId);
  assert.equal(ref, "e1");
  assert.equal(findByLocator(liveTickElements, resolved.locator)?.index, 0);
});

test("external links in user messages and outbound redirectors are excluded while structural links are preserved (R4)", () => {
  // Given user-shared links (Google Drive, Meet, Zoom, safety redirectors, literal URLs) alongside structural links
  assert.equal(
    isUserContentExternalLink(
      { name: "https://drive.google.com/file/d/1awmdsn/view?usp=drive_link", href: "https://drive.google.com/file/d/1awmdsn/view" },
      { href: "https://drive.google.com", external: true },
      PAGE.url,
    ),
    true,
  );
  assert.equal(
    isUserContentExternalLink(
      { name: "Join meeting", href: "https://meet.google.com/dyf-auqr-fgf" },
      { href: "https://meet.google.com", external: true },
      PAGE.url,
    ),
    true,
  );
  assert.equal(
    isUserContentExternalLink(
      { name: "Abrir https://join.com/terms", href: "http://localhost:8080/safety/go/?url=https%3A%2F%2Fjoin.com%2Fterms" },
      { href: "http://localhost:8080/safety/go/?url=https%3A%2F%2Fjoin.com%2Fterms", external: false },
      PAGE.url,
    ),
    true,
  );
  assert.equal(
    isUserContentExternalLink(
      { name: "Shared doc", href: "https://arbitrary-blog.example.org/post/1", containerRole: "list", containerName: "Lista de conversaciones" },
      { href: "https://arbitrary-blog.example.org", external: true },
      PAGE.url,
    ),
    true,
  );
  assert.equal(
    isUserContentExternalLink(
      { name: "Help center", href: "https://help.example.com/docs" },
      { href: "https://help.example.com", external: true },
      PAGE.url,
    ),
    false,
  );

  const elements: RawElement[] = [
    { role: "link", name: "https://drive.google.com/file/d/1awmdsn-bve4dsfr/view?usp=drive_link", nameSource: "content", occurrence: 0, href: "https://drive.google.com/file/d/1awmdsn-bve4dsfr/view?usp=drive_link" },
    { role: "link", name: "https://meet.google.com/dyf-auqr-fgf", nameSource: "content", occurrence: 0, href: "https://meet.google.com/dyf-auqr-fgf" },
    { role: "link", name: "Zoom Call", nameSource: "content", occurrence: 0, href: "https://zoom.us/j/123456789" },
    { role: "link", name: "Abrir https://join.com/privacy-policy", nameSource: "aria-label", occurrence: 0, href: "http://localhost:8080/safety/go/?url=https%3A%2F%2Fjoin.com%2Fprivacy-policy" },
    { role: "link", name: "Help center", nameSource: "content", occurrence: 0, href: "https://help.example.com/articles" },
    { role: "link", name: "Profile", nameSource: "content", occurrence: 0, href: "/profile" },
  ];

  // When learning the screen
  const screen = learnScreen(elements, PAGE, { now: NOW });

  // Then only structural internal and external links remain
  assert.deepEqual(screen.links.map((l) => [l.id, l.href, l.external]), [
    ["help-center", "https://help.example.com", true],
    ["profile", "/profile", false],
  ]);
});

test("informal dynamic conversation lists and per-message item action menus are excluded from global targets (R5)", () => {
  // Given informal conversation list items, per-message options menus, and inline attachment download buttons
  assert.equal(
    isConversationItemControl({
      role: "button",
      name: "Abre la lista de opciones en tu conversación con Xavi Pin y Sebastian Contreras",
      occurrence: 0,
    }),
    true,
  );
  assert.equal(
    isConversationItemControl({
      role: "button",
      name: "Sebastian-Contreras.pdf 44 KB Descargar",
      occurrence: 0,
    }),
    true,
  );
  assert.equal(
    isConversationItemControl({
      role: "button",
      name: "Más opciones",
      occurrence: 2,
    }),
    true,
  );
  assert.equal(
    isConversationItemControl({
      role: "button",
      name: "Descartar empleo «Senior Backend Engineer»",
      occurrence: 0,
    }),
    true,
  );

  const dom = new JSDOM(`<!doctype html><html><body>
    <button>Más opciones</button>
    <ul aria-label="Lista de mensajes de la conversación">
      <li>
        <button aria-label="Abre la lista de opciones en tu conversación con Xavi Pin y Sebastian Contreras">...</button>
        <button>Sebastian-Contreras.pdf 44 KB Descargar</button>
        <button aria-label="Más opciones">...</button>
        <button>Juan Pérez</button>
      </li>
    </ul>
    <button>Más opciones</button>
    <button>Enviar</button>
  </body></html>`);

  // When collecting and learning the screen
  const collected = collectInteractive(dom.window.document);
  const screen = learnScreen(collected, PAGE, { now: NOW });

  // Then per-message menus, attachment downloads, and repeated item menus are excluded from root actions,
  // while the informal conversation list is folded into a dynamicChildren pattern and global controls stay
  assert.deepEqual(screen.actions.map((a) => a.id), ["mas-opciones", "enviar"]);
  assert.deepEqual(
    (screen.patterns ?? []).map((p) => [p.containerRole, p.containerName, p.itemRole, p.dynamicChildren]),
    [["list", "Lista de mensajes de la conversación", "button", true]],
  );
});
