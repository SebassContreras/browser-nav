import assert from "node:assert/strict";
import { test } from "node:test";
import { pruneScreenNoise } from "../screen-prune.js";
import type { Screen } from "../screen-map.js";

test("pruneScreenNoise strips transient item actions and content links while recalculating valid sha256 fingerprint (R4)", () => {
  // Given a screen with structural buttons, card dismiss buttons, and news links
  const screen: Screen = {
    id: "jobs",
    route: "/jobs",
    title: "Empleos",
    access: "public",
    fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    observedAt: "2026-10-25T18:00:00Z",
    fields: [
      {
        id: "search",
        role: "textbox",
        name: "Buscar",
        nameSource: "placeholder",
        sensitive: false,
        agentFillable: true,
        locator: { role: "textbox", name: "Buscar", occurrence: 0 },
      },
    ],
    actions: [
      {
        id: "filtrar-por-solicitud-sencilla",
        role: "button",
        name: "Filtrar por Solicitud sencilla",
        kind: "button",
        effect: "ui-state",
        locator: { role: "button", name: "Filtrar por Solicitud sencilla", occurrence: 0 },
      },
      {
        id: "descartar-empleo-senior-backend",
        role: "button",
        name: "Descartar empleo 'Senior Backend Engineer'",
        kind: "button",
        effect: "none",
        locator: { role: "button", name: "Descartar empleo 'Senior Backend Engineer'", occurrence: 0 },
      },
      {
        id: "pagina-2",
        role: "button",
        name: "Página 2",
        kind: "button",
        effect: "submit",
        locator: { role: "button", name: "Página 2", occurrence: 0 },
      },
    ],
    links: [
      {
        id: "feed",
        name: "Inicio",
        href: "/feed/",
        external: false,
        locator: { role: "link", name: "Inicio", occurrence: 0 },
      },
      {
        id: "noticia",
        name: "Noticia",
        href: "/news/story/top-startups-2026/",
        external: false,
        locator: { role: "link", name: "Noticia", occurrence: 0 },
      },
    ],
    flows: [],
  };

  // When pruning noise from the screen
  const { prunedScreen, actionsRemoved, linksRemoved } = pruneScreenNoise(screen);

  // Then transient item actions and story links are removed
  assert.equal(actionsRemoved, 1);
  assert.equal(linksRemoved, 1);
  assert.deepEqual(prunedScreen.actions.map((a) => a.id), ["filtrar-por-solicitud-sencilla", "pagina-2"]);
  assert.deepEqual(prunedScreen.links.map((l) => l.id), ["feed"]);

  // And the fingerprint is freshly calculated and non-empty
  assert.match(prunedScreen.fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(prunedScreen.fingerprint, screen.fingerprint);
});
