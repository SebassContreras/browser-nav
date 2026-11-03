// Live actions over BiDi (spec 004, T009): actionability checks, pointer click,
// key-input fill with readback, settle wait.
// Node handles are not valid across BiDi sessions, so every action runs in ONE session:
// collect -> match locator -> get node handle -> act. The caller wraps this in withSession.
// The in-page functions below are shipped as source text (toString) and must stay
// self-contained: no imports, no outer-scope references.
import { PwaNavError } from "../core/errors.js";
import type { BidiClient, NavigationWatch, NodeArgument } from "../bidi/protocol.js";
import { SETTLE_EVENTS } from "../bidi/protocol.js";
import { StaleRefError } from "../core/refs.js";
import type { Locator } from "../screens/screen-map.js";
import type { Snapshot } from "../core/snapshot.js";
import { COLLECT_NODES_SOURCE, COLLECTOR_SOURCE, type RawElement } from "./collector.js";
import { assertFresh } from "./locate.js";

// Settle constants, validated by the real-Firefox E2E (T012, Firefox 156.0.1 headless, Windows):
// - navigationStarted arrived 14-20 ms after a link click and load 30 ms (local page); a
//   page-initiated navigation 250 ms after the click (setTimeout) arrived at 259 ms.
// - pushState SPA clicks emit no navigationStarted (only historyUpdated), so they take the
//   DOM-quiescence path; the CLI click commands cost ~550-1100 ms end to end, ~150 ms for reads.
/** How long to wait for a navigationStarted after the input before assuming no navigation.
 * Events need <= 30 ms, but this window is also the minimum wait for async renders (a render
 * 200 ms after the click was captured; at 150 ms it would race). A later navigation is still
 * caught by the quiescence fallback in settle(). Kept at 300. */
export const SETTLE_WINDOW_MS = 300;
/** Quiet period without DOM mutations that counts as "settled". A 50 ms ticker never counted as
 * quiet (correct); 150 ms rides over typical frame/microtask bursts. Kept at 150. */
export const QUIET_MS = 150;
/** Hard cap for the settle wait (load wait and DOM quiescence). A page with perpetual
 * mutations costs exactly this per action (measured 2.2 s for a 2 s ticker). Kept at 5000. */
export const SETTLE_TIMEOUT_MS = 5000;

export interface ActionOptions {
  /** Must match the options used when the snapshot was taken. */
  includeAll?: boolean;
  /** Skip the settle wait (tests / batch callers). Default true. */
  settle?: boolean;
}

export interface PageState {
  url: string;
  title: string;
}

export interface LiveCollect extends PageState {
  raw: RawElement[];
}

interface ActionableResult {
  ok: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// In-page functions (self-contained)
// ---------------------------------------------------------------------------

/**
 * Actionability: visible, enabled, scrolled into view, stable across two animation
 * frames, not covered. Resolves `{ok:false, reason}` on the first failing check.
 */
export async function checkActionable(el: Element): Promise<ActionableResult> {
  const view = el.ownerDocument.defaultView;
  if (view === null) return { ok: false, reason: "element is detached from a window" };
  if (!el.isConnected) return { ok: false, reason: "element is not in the document" };

  let disabled = el.getAttribute("aria-disabled") === "true";
  if (!disabled) {
    try {
      disabled = el.matches(":disabled");
    } catch {
      disabled = el.hasAttribute("disabled");
    }
  }
  if (disabled) return { ok: false, reason: "element is disabled" };

  // For native file inputs, bounding box and visibility checks are bypassed because
  // file inputs are styled invisible/hidden in modern frontends.
  const isFileInput = el.localName === "input" && (el.getAttribute("type") ?? "").trim().toLowerCase() === "file";
  if (isFileInput) {
    return { ok: true };
  }

  const isCheckOrRadio =
    el.localName === "input" && ["checkbox", "radio"].includes((el.getAttribute("type") ?? "").trim().toLowerCase());
  const escapeCss = (val: string): string => {
    const css = (view as unknown as { CSS?: { escape?: (s: string) => string } }).CSS;
    if (typeof css?.escape === "function") return css.escape(val);
    return val.replace(/["\\]/g, "\\$&");
  };
  const findAssociatedLabel = (): HTMLElement | null => {
    const input = el as HTMLInputElement;
    if (input.labels && input.labels.length > 0 && input.labels[0] !== undefined) return input.labels[0];
    const parentLabel = el.closest<HTMLLabelElement>("label");
    if (parentLabel) return parentLabel;
    if (el.id) {
      return el.ownerDocument.querySelector<HTMLLabelElement>(`label[for="${escapeCss(el.id)}"]`);
    }
    return null;
  };

  const isElementVisible = (node: Element): boolean => {
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  let target = el;
  let usingLabelDelegation = false;
  if (isCheckOrRadio && !isElementVisible(el)) {
    const assocLabel = findAssociatedLabel();
    if (assocLabel && isElementVisible(assocLabel)) {
      target = assocLabel;
      usingLabelDelegation = true;
    }
  }

  if (!isElementVisible(target)) return { ok: false, reason: "element is not visible" };

  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "center", inline: "center" });
  }

  const frame = (): Promise<void> =>
    new Promise<void>((resolve) => {
      let resolved = false;
      const done = (): void => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      if (typeof view.requestAnimationFrame === "function" && !view.document.hidden) {
        view.requestAnimationFrame(done);
      }
      setTimeout(done, 32);
    });
  const sameRect = (a: DOMRect, b: DOMRect): boolean =>
    a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
  const first = target.getBoundingClientRect();
  await frame();
  const second = target.getBoundingClientRect();
  await frame();
  const third = target.getBoundingClientRect();
  if (!sameRect(first, second) || !sameRect(second, third)) {
    return { ok: false, reason: "element is not stable (still moving)" };
  }
  if (!isElementVisible(target)) return { ok: false, reason: "element is not visible" };

  const cx = third.left + third.width / 2;
  const cy = third.top + third.height / 2;
  const root = target.getRootNode() as Document | ShadowRoot;
  const hit = root.elementFromPoint(cx, cy);
  if (hit === null) return { ok: false, reason: "element center is outside the viewport" };
  const label = hit.closest<HTMLLabelElement>("label");
  const isLabelForEl =
    label?.control === el ||
    (label !== null && label.contains(el)) ||
    (usingLabelDelegation && (hit === target || target.contains(hit)));
  const isAncestor = hit.contains(target);
  if (hit !== target && !target.contains(hit) && !isAncestor && !isLabelForEl) {
    return { ok: false, reason: `element is covered by <${hit.localName}>` };
  }
  return { ok: true };
}

type FillKind = "text" | "password" | "contenteditable" | "select";
interface FillTarget {
  ok: boolean;
  reason?: string;
  kind?: FillKind;
  /** Secret-like field: typed text and values are never read back or returned. */
  sensitive?: boolean;
}

/** Matches option in <select> by exact label, exact value, or substring, and dispatches events. */
export function selectOption(sel: HTMLSelectElement, text: string): { ok: boolean; reason?: string } {
  const norm = (s: string): string => s.trim().toLowerCase();
  const search = norm(text);
  const options = Array.from(sel.options);

  // 1. Exact label match
  let matched = options.find((o) => norm(o.label || o.text) === search);
  // 2. Exact value match
  if (!matched) {
    matched = options.find((o) => norm(o.value) === search);
  }
  // 3. Case-insensitive substring match (label first, then value)
  if (!matched && search !== "") {
    matched = options.find((o) => norm(o.label || o.text).includes(search) || norm(o.value).includes(search));
  }

  if (!matched) {
    return { ok: false, reason: `No option matches "${text}" in <select>` };
  }

  sel.value = matched.value;
  const viewEvent = (sel.ownerDocument.defaultView as unknown as { Event?: typeof Event } | null)?.Event;
  const EventCtor = viewEvent ?? Event;
  sel.dispatchEvent(new EventCtor("input", { bubbles: true, cancelable: true }));
  sel.dispatchEvent(new EventCtor("change", { bubbles: true, cancelable: true }));
  return { ok: true };
}

/** Validates the target is typeable, then focuses it. Returns no values. */
export function prepareFill(el: Element): FillTarget {
  const tag = el.localName;
  const typeable = new Set(["", "text", "email", "search", "tel", "url", "number", "password"]);
  let kind: FillKind;
  let sensitive = false;
  if (tag === "input") {
    const input = el as HTMLInputElement;
    const type = (el.getAttribute("type") ?? "").trim().toLowerCase();
    if (!typeable.has(type)) return { ok: false, reason: `input type "${type}" does not accept typed text` };
    if (input.readOnly) return { ok: false, reason: "input is read-only" };
    kind = type === "password" ? "password" : "text";
    sensitive = kind === "password" || /password|cc-|one-time-code/i.test(el.getAttribute("autocomplete") ?? "");
  } else if (tag === "textarea") {
    if ((el as HTMLTextAreaElement).readOnly) return { ok: false, reason: "textarea is read-only" };
    kind = "text";
    sensitive = /password|cc-|one-time-code/i.test(el.getAttribute("autocomplete") ?? "");
  } else if (tag === "select") {
    const select = el as HTMLSelectElement;
    if (select.disabled) return { ok: false, reason: "select is disabled" };
    kind = "select";
  } else if ((el as HTMLElement).isContentEditable) {
    kind = "contenteditable";
  } else {
    return { ok: false, reason: `<${tag}> is not an editable field` };
  }
  (el as HTMLElement).focus();
  const root = el.getRootNode() as Document | ShadowRoot;
  if (root.activeElement !== el && !el.contains(root.activeElement)) {
    return { ok: false, reason: "element did not take focus" };
  }
  if (kind === "contenteditable") {
    // E2E (Firefox 156): focus() alone leaves no caret in a contenteditable, so typed keys are
    // dropped. Put the caret at the end; select-all then selects the editing host's content.
    const view = el.ownerDocument.defaultView;
    const selection = view?.getSelection();
    if (selection !== null && selection !== undefined) {
      const range = el.ownerDocument.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  return { ok: true, kind, sensitive };
}

/**
 * Compares the field with what was typed. `expected` is the exact text, or, for
 * sensitive fields, only its LENGTH (a number): the secret is never read out of the page.
 * Returns a boolean only.
 */
export function readBackMatches(el: Element, expected: string | number): boolean {
  if (el.localName === "select") {
    const sel = el as HTMLSelectElement;
    const selected = sel.selectedOptions[0];
    const exp = typeof expected === "string" ? expected.trim().toLowerCase() : "";
    if (selected) {
      const label = (selected.label || selected.text || "").trim().toLowerCase();
      const val = selected.value.trim().toLowerCase();
      return label === exp || val === exp || label.includes(exp) || val.includes(exp);
    }
    return sel.value.trim().toLowerCase() === exp;
  }
  const actual =
    el.localName === "input" || el.localName === "textarea"
      ? (el as HTMLInputElement).value
      : el.textContent;
  if (typeof expected === "number") return actual.length === expected;
  // E2E (Firefox 156): contenteditable turns runs of spaces into U+00A0; the user typed spaces.
  const editable = el.localName !== "input" && el.localName !== "textarea";
  const norm = (text: string): string => {
    const lf = text.replace(/\r\n/g, "\n");
    return editable ? lf.replace(/ /g, " ") : lf;
  };
  return norm(actual) === norm(expected);
}

/**
 * Lets frame-deferred page logic (rAF/timeout-driven re-renders, masks) finish before the
 * readback. Resolves after two animation frames, or after 100 ms if frames never fire
 * (throttled/hidden window).
 */
function waitFrames(): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(finish);
    });
    setTimeout(finish, 100);
  });
}

/** Resolves after `quietMs` without DOM mutations, or at `capMs` regardless. */
function waitQuiet(quietMs: number, capMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const done = (value: boolean): void => {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(cap);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        done(true);
      }, quietMs);
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    quiet = setTimeout(() => {
      done(true);
    }, quietMs);
    const cap = setTimeout(() => {
      done(false);
    }, capMs);
  });
}

const PAGE_STATE_SOURCE = "() => ({ url: location.href, title: document.title })";

const COLLECT_LIVE_SOURCE =
  `(includeAll) => ({ url: location.href, title: document.title, ` +
  `raw: (${COLLECTOR_SOURCE})(document, { includeAll }) })`;

// Node handle for collected `index`; null when role/name at that index no longer match.
// When an input is checkbox/radio and visually hidden (zero-sized or styled hidden), delegates to visible associated label.
const LOCATE_NODE_SOURCE =
  `(index, role, name, includeAll) => { ` +
  `const options = { includeAll }; ` +
  `const items = (${COLLECTOR_SOURCE})(document, options); ` +
  `const nodes = (${COLLECT_NODES_SOURCE})(document, options); ` +
  `const item = items[index]; ` +
  `if (item === undefined || item.role !== role || item.name !== name) return null; ` +
  `const node = nodes[index]; ` +
  `if (node && node.localName === "input") { ` +
  `  const type = (node.getAttribute("type") || "").toLowerCase().trim(); ` +
  `  if (type === "checkbox" || type === "radio") { ` +
  `    const style = window.getComputedStyle(node); ` +
  `    const rect = node.getBoundingClientRect(); ` +
  `    const isHidden = style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || rect.width === 0 || rect.height === 0; ` +
  `    if (isHidden) { ` +
  `      const esc = (window.CSS && typeof window.CSS.escape === "function") ? window.CSS.escape(node.id) : node.id.replace(/["\\\\]/g, "\\\\$&"); ` +
  `      const assoc = (node.labels && node.labels.length > 0) ? node.labels[0] : (node.closest("label") || (node.id ? node.ownerDocument.querySelector('label[for="' + esc + '"]') : null)); ` +
  `      if (assoc) { ` +
  `        const lStyle = window.getComputedStyle(assoc); ` +
  `        const lRect = assoc.getBoundingClientRect(); ` +
  `        if (lStyle.display !== "none" && lStyle.visibility !== "hidden" && lRect.width > 0 && lRect.height > 0) { ` +
  `          return assoc; ` +
  `        } ` +
  `      } ` +
  `    } ` +
  `  } ` +
  `} ` +
  `return node; }`;

export const CHECK_ACTIONABLE_SOURCE = `(${checkActionable.toString()})`;
const PREPARE_FILL_SOURCE = `(${prepareFill.toString()})`;
const SELECT_OPTION_SOURCE = `(${selectOption.toString()})`;
const READ_BACK_SOURCE = `(${readBackMatches.toString()})`;
const WAIT_QUIET_SOURCE = `(${waitQuiet.toString()})`;
const WAIT_FRAMES_SOURCE = `(${waitFrames.toString()})`;

// ---------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------

const bool = (value: boolean): { type: "boolean"; value: boolean } => ({ type: "boolean", value });
const str = (value: string): { type: "string"; value: string } => ({ type: "string", value });
const num = (value: number): { type: "number"; value: number } => ({ type: "number", value });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function protocolError(message: string): PwaNavError {
  return new PwaNavError("protocol", message);
}

export async function collectLive(
  client: BidiClient,
  context: string,
  options: { includeAll?: boolean } = {},
): Promise<LiveCollect> {
  const res = await client.callFunction(context, COLLECT_LIVE_SOURCE, [bool(options.includeAll === true)]);
  if (!isRecord(res) || typeof res["url"] !== "string" || typeof res["title"] !== "string" || !Array.isArray(res["raw"])) {
    throw protocolError("Malformed collector result");
  }
  return { url: res["url"], title: res["title"], raw: res["raw"] as RawElement[] };
}

function sensitiveElement(element: RawElement): boolean {
  return element.inputType === "password" || /password|cc-|one-time-code/i.test(element.autocomplete ?? "");
}

/** Pure text for dry-run output. Never includes typed text of sensitive targets. */
export function describeTarget(args: {
  action: "click" | "fill" | "upload";
  locator: Locator;
  element?: RawElement;
  text?: string;
  files?: readonly string[];
}): string {
  const { action, locator, element, text, files } = args;
  const occurrence = locator.occurrence ?? 0;
  let out = `${action} ${locator.role} "${locator.name}" (occurrence ${String(occurrence)})`;
  if (action === "fill" && text !== undefined) {
    const redact = element !== undefined && sensitiveElement(element);
    out += redact ? ` with <redacted, ${String(text.length)} chars>` : ` with ${JSON.stringify(text)}`;
  } else if (action === "upload" && files !== undefined) {
    out += ` with ${files.join(", ")}`;
  }
  if (element !== undefined) {
    const isFileInput = element.inputType === "file";
    const info: string[] = [element.disabled === true ? "disabled" : "enabled"];
    if (!isFileInput) info.push("visible");
    if (element.inputType !== undefined) info.push(`type=${element.inputType}`);
    out += ` [${info.join(", ")}]`;
  }
  return out;
}

interface Located {
  sharedId: string;
  element: RawElement;
  index: number;
}

function notActionable(locator: Locator, reason: string, hint?: string): PwaNavError {
  return new PwaNavError(
    "not_actionable",
    `Element role "${locator.role}" name "${locator.name}" is not actionable: ${reason}`,
    { hint: hint ?? "Re-snapshot, wait for the page to settle or dismiss overlays, then retry." },
  );
}

async function locate(
  client: BidiClient,
  context: string,
  snapshot: Snapshot,
  locator: Locator,
  options: ActionOptions,
): Promise<Located> {
  const live = await collectLive(client, context, options);
  const { index, element } = assertFresh({ snapshot, locator, live });
  const remote = await client.callFunctionRaw(
    context,
    LOCATE_NODE_SOURCE,
    [num(index), str(element.role), str(element.name), bool(options.includeAll === true)],
    { resultOwnership: "root" },
  );
  const sharedId = (remote as { sharedId?: unknown }).sharedId;
  if (remote.type !== "node" || typeof sharedId !== "string") {
    throw new StaleRefError(snapshot.snapshotId, "the element disappeared while locating it");
  }
  return { sharedId, element, index };
}

const nodeArg = (sharedId: string): NodeArgument => ({ type: "node", sharedId });

async function ensureActionable(client: BidiClient, context: string, located: Located, locator: Locator): Promise<void> {
  const res = await client.callFunction(context, CHECK_ACTIONABLE_SOURCE, [nodeArg(located.sharedId)]);
  if (!isRecord(res) || typeof res["ok"] !== "boolean") throw protocolError("Malformed actionability result");
  if (!res["ok"]) {
    throw notActionable(locator, typeof res["reason"] === "string" ? res["reason"] : "unknown reason");
  }
}

async function pageState(client: BidiClient, context: string): Promise<PageState> {
  const res = await client.callFunction(context, PAGE_STATE_SOURCE);
  if (!isRecord(res) || typeof res["url"] !== "string" || typeof res["title"] !== "string") {
    throw protocolError("Malformed page state");
  }
  return { url: res["url"], title: res["title"] };
}

/**
 * Waits for the page to settle after an input.
 * 1. Full navigation (started within SETTLE_WINDOW_MS) -> wait for load.
 * 2. Otherwise, wait for network idle (in-flight requests reach 0) and DOM quiescence
 *    (QUIET_MS without mutations). If a response triggers further requests or a late
 *    navigation, loops until quiet or navigation loads.
 * Hitting SETTLE_TIMEOUT_MS during quiescence/network idle returns the current page state:
 * pages with perpetual mutations or polling never go quiet, and the input already
 * happened, so failing would misreport a successful action.
 * A load that never completes after a navigation does raise `timeout`.
 * `watch` must have been created before the input; without one, it starts now.
 */
export async function settle(client: BidiClient, context: string, watch?: NavigationWatch): Promise<PageState> {
  let own: NavigationWatch | undefined;
  let w = watch;
  if (w === undefined) {
    await client.subscribe(SETTLE_EVENTS, [context]);
    own = client.watchNavigation(context);
    w = own;
  }
  const startedAt = Date.now();
  const remaining = (): number => Math.max(0, SETTLE_TIMEOUT_MS - (Date.now() - startedAt));

  try {
    if (await w.waitStarted(SETTLE_WINDOW_MS)) {
      await w.waitLoaded(remaining());
    } else {
      const navStarted = (): boolean => (w as { readonly started: boolean }).started;
      const inFlight = (): number => (w as { readonly inFlightCount: number }).inFlightCount;
      while (remaining() > 0) {
        if (navStarted()) {
          await w.waitLoaded(remaining());
          break;
        }
        if (inFlight() > 0) {
          await w.waitNetworkIdle(remaining());
          if (navStarted()) {
            await w.waitLoaded(remaining());
            break;
          }
        }
        try {
          const capMs = remaining() >= SETTLE_TIMEOUT_MS - 500 ? SETTLE_TIMEOUT_MS : remaining();
          await client.callFunction(context, WAIT_QUIET_SOURCE, [num(QUIET_MS), num(capMs)]);
        } catch (error) {
          // The document may have been replaced mid-wait by a late navigation.
          if (!navStarted()) throw error;
          await w.waitLoaded(remaining());
          break;
        }
        if (navStarted()) {
          await w.waitLoaded(remaining());
          break;
        }
        if (inFlight() === 0) {
          break;
        }
      }
    }
    return await pageState(client, context);
  } finally {
    own?.dispose();
  }
}

async function armWatch(client: BidiClient, context: string): Promise<NavigationWatch> {
  await client.subscribe(SETTLE_EVENTS, [context]);
  return client.watchNavigation(context);
}

export async function clickLocator(
  client: BidiClient,
  context: string,
  snapshot: Snapshot,
  locator: Locator,
  options: ActionOptions = {},
): Promise<PageState> {
  const located = await locate(client, context, snapshot, locator, options);
  await ensureActionable(client, context, located, locator);
  const watch = await armWatch(client, context);
  try {
    await client.performActions(context, [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", x: 0, y: 0, origin: { type: "element", element: { sharedId: located.sharedId } } },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ]);
    await client.releaseActions(context);
    return options.settle === false ? await pageState(client, context) : await settle(client, context, watch);
  } finally {
    watch.dispose();
  }
}

// WebDriver special key codepoints (https://w3c.github.io/webdriver/#keyboard-actions).
const KEY_CONTROL = "";
const KEY_META = "";
const KEY_BACKSPACE = "";
const KEY_ENTER = "";

const keyPair = (value: string): unknown[] => [
  { type: "keyDown", value },
  { type: "keyUp", value },
];

/**
 * Key actions: select-all, then one keyDown/keyUp pair per Unicode code point
 * (empty text -> Backspace to delete the selection). "\n" is sent as Enter.
 * Code points in the private-use block U+E000-U+F8FF are WebDriver special keys and are rejected.
 */
export function buildFillKeyActions(text: string, platform: string = process.platform): unknown[] {
  const modifier = platform === "darwin" ? KEY_META : KEY_CONTROL;
  const actions: unknown[] = [
    { type: "keyDown", value: modifier },
    ...keyPair("a"),
    { type: "keyUp", value: modifier },
  ];
  if (text === "") {
    actions.push(...keyPair(KEY_BACKSPACE));
    return actions;
  }
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      throw new PwaNavError("invalid_args", "Text contains a private-use code point (reserved for special keys)");
    }
    actions.push(...keyPair(ch === "\n" ? KEY_ENTER : ch));
  }
  return actions;
}

/**
 * Types `text` into the located field and verifies it. Non-sensitive fields: exact
 * comparison done in-page (only a boolean comes back). Sensitive fields (password,
 * cc-*, one-time-code): only the LENGTH is compared; the value is never read or returned.
 * Typed text is never placed in errors or results.
 */
export async function fillLocator(
  client: BidiClient,
  context: string,
  snapshot: Snapshot,
  locator: Locator,
  text: string,
  options: ActionOptions = {},
): Promise<PageState> {
  const keys = buildFillKeyActions(text); // validates before any browser interaction
  const located = await locate(client, context, snapshot, locator, options);
  await ensureActionable(client, context, located, locator);
  const watch = await armWatch(client, context);
  try {
    const prep = await client.callFunction(context, PREPARE_FILL_SOURCE, [nodeArg(located.sharedId)]);
    if (!isRecord(prep) || typeof prep["ok"] !== "boolean") throw protocolError("Malformed fill preparation result");
    if (!prep["ok"]) {
      throw notActionable(
        locator,
        typeof prep["reason"] === "string" ? prep["reason"] : "unsupported target",
        "fill supports text inputs, textareas, contenteditable and select dropdowns; use click for other controls.",
      );
    }
    const kind = prep["kind"];
    const sensitive = prep["sensitive"] === true;

    if (kind === "select") {
      const selectRes = await client.callFunction(context, SELECT_OPTION_SOURCE, [nodeArg(located.sharedId), str(text)]);
      if (!isRecord(selectRes) || typeof selectRes["ok"] !== "boolean") throw protocolError("Malformed select result");
      if (!selectRes["ok"]) {
        throw notActionable(
          locator,
          typeof selectRes["reason"] === "string" ? selectRes["reason"] : "no matching option",
          "Check the option labels and values in the select element.",
        );
      }
    } else {
      await client.performActions(context, [{ type: "key", id: "keyboard", actions: keys }]);
      await client.releaseActions(context);
    }

    // E2E (Firefox 156): a page that rewrites the value in requestAnimationFrame is only
    // visible ~1 frame after the keys; an immediate readback would pass a value that changes next.
    await client.callFunction(context, WAIT_FRAMES_SOURCE);
    const expected = sensitive ? num(text.length) : str(text);
    const match = await client.callFunction(context, READ_BACK_SOURCE, [nodeArg(located.sharedId), expected]);
    if (match !== true) {
      throw notActionable(
        locator,
        sensitive ? "value length after typing differs" : "value after typing differs",
        "The page may rewrite or reject input (masks, controlled inputs); inspect the field manually.",
      );
    }
    return options.settle === false ? await pageState(client, context) : await settle(client, context, watch);
  } finally {
    watch.dispose();
  }
}

/**
 * Sets local file paths on an `<input type="file">` element via WebDriver BiDi `input.setFiles`.
 */
export async function uploadFiles(
  client: BidiClient,
  context: string,
  snapshot: Snapshot,
  locator: Locator,
  files: readonly string[],
  options: ActionOptions = {},
): Promise<PageState> {
  const located = await locate(client, context, snapshot, locator, options);
  await ensureActionable(client, context, located, locator);
  const watch = await armWatch(client, context);
  try {
    await client.setFiles(context, { sharedId: located.sharedId }, files);
    return options.settle === false ? await pageState(client, context) : await settle(client, context, watch);
  } finally {
    watch.dispose();
  }
}

