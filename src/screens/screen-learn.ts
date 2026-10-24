// Screen learner for spec 005-screen-map (T006): live collector elements -> `Screen`.
// Pure functions, no IO, no globals. Merge/diff/prune against an existing map (T007) will
// live in this file as separate functions that consume `learnScreen` output.
// Flows are never invented: `flows` is always [] and flow authoring stays manual.
import type { RawElement } from "../browser/collector.js";
import {
  fingerprintOf,
  mergeOpensBranch,
  screenElements,
  type A11yFinding,
  type Locator,
  type OpensBranch,
  type Screen,
  type ScreenAction,
  type ScreenField,
  type ScreenLink,
  type EntityPattern,
} from "./screen-map.js";

export interface LearnPage {
  url: string;
  title: string;
  appOrigin: string;
}

export interface LearnOptions {
  now?: Date;
  /** Overrides the id derived from the route. */
  screenId?: string;
  access?: Screen["access"];
  /** Ids already taken (e.g. by an existing map entry); derived ids avoid them. */
  existingIds?: ReadonlySet<string>;
  /** Names of submit buttons. Overrides/complements `RawElement.buttonType`. */
  submitNames?: ReadonlySet<string>;
  /** Last clicked action to nest newly appeared dialogs/modals into */
  lastAction?: { id?: string; name?: string };
}

// Roles outside these three groups (heading, tab panels, menuitemcheckbox, ...) are ignored.
const FIELD_ROLES: ReadonlySet<string> = new Set([
  "textbox", "searchbox", "spinbutton", "combobox", "listbox", "slider", "checkbox", "radio", "switch",
]);
const ACTION_ROLES: ReadonlySet<string> = new Set(["button", "menuitem", "tab", "option"]);
// Toggles/choices are not required to submit a form.
const OPTIONAL_FIELD_ROLES: ReadonlySet<string> = new Set(["checkbox", "radio", "switch"]);
// User-content streams (WAI-ARIA feed/log/article): their elements are never persisted
// as individual targets, only as one `dynamicChildren` pattern per item role.
const DYNAMIC_CONTAINER_ROLES: ReadonlySet<string> = new Set(["feed", "log", "article"]);

const SENSITIVE_AUTOCOMPLETE: ReadonlySet<string> = new Set(["current-password", "new-password", "one-time-code"]);
// Broad on purpose: a false positive only forces the user to fill by hand.
const SENSITIVE_NAME = /pass|pwd|contrase|token|otp|secret|clave/i;
const TOGGLE_NAME = /^(show|hide|toggle|mostrar|ocultar|alternar)\b/i;

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_SEGMENT = /^\d{4,}$/;
const HEX_HASH_SEGMENT = /^(?:(?=.*[0-9])(?=.*[a-f])[0-9a-f]{8,}|[0-9a-f]{16,})$/i;
const PREFIXED_TOKEN_SEGMENT = /^\d+-[A-Za-z0-9_-]{8,}=*$/;
const PADDED_BASE64_SEGMENT = /^[A-Za-z0-9_-]{8,}={1,2}$/;
const HIGH_ENTROPY_TOKEN_SEGMENT = /^(?:(?=.*[A-Za-z])(?=.*[0-9])|(?=.*[a-z])(?=.*[A-Z]))[A-Za-z0-9_-]{16,}=*$/;

/** NFD-fold to ASCII, lowercase, non-alphanumeric runs -> `-`, trimmed. May return "". */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BADGE_SUFFIX_PATTERNS: readonly RegExp[] = [
  // e.g. ", 3 notificaciones nuevas", ", 1 nueva notificación", ", 0 nuevas notificaciones", " - 5 new notifications"
  /(?:\s*[,•·|–—-]\s*|\s+)\d+(?:[.,]\d+)?\+?\s*(?:nuev[oa]s?\s+|new\s+|unread\s+|no\s+le[ií]d[oa]s?\s+)?(?:notificaciones|notificaci[oó]n|notifications|notification|mensajes|mensaje|messages|message|alertas|alerta|alerts|alert|avisos|aviso|elementos|items|updates|actualizaciones)(?:\s+(?:nuev[oa]s?|new|sin\s+leer|no\s+le[ií]d[oa]s?|unread))?\s*$/i,
  // e.g. "(3)", "(12 unread)", "(5 sin leer)", "[2 notificaciones]"
  /\s*(?:\(\s*\d+(?:[.,]\d+)?\+?(?:\s+[^)]*)?\s*\)|\[\s*\d+(?:[.,]\d+)?\+?(?:\s+[^\]]*)?\s*\])\s*$/i,
  // e.g. "Hace 14 horas • 2042 lectores", "3h ago • 377 readers", "Hace 6 horas"
  /(?:\s*[,•·|–—-]\s*|\s+)(?:hace\s+\d+\s+(?:segundos?|minutos?|horas?|d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)|\d+\s*(?:s|m|h|d|w|mo|yr|y|sec|min|hr|hrs|hour|hours|day|days|week|weeks)\s+ago)(?:\s*[,•·|–—-]?\s*\d+(?:[.,]\d+)?\s*(?:lectores|readers|visualizaciones|views|comentarios|comments))?\s*$/i,
  // e.g. "• 377 lectores", "• 1,204 readers", "220.548 seguidores", "14 contactos han jugado"
  /(?:\s*[,•·|–—-]\s*|\s+)\d+(?:[.,]\d+)?\s*(?:lectores|readers|seguidores|followers|contactos\s+han\s+jugado|connections\s+played|playing)\s*$/i,
];

/** Scrubs volatile notification counts, unread badges, and live reader/follower metrics from an accessible name (R3). */
export function scrubMutableBadgeCounts(name: string): string {
  let current = name.trim();
  if (current === "") {
    return "";
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of BADGE_SUFFIX_PATTERNS) {
      const next = current.replace(pattern, "").trim();
      if (next !== current && next.length > 0) {
        current = next;
        changed = true;
      }
    }
  }
  return current;
}

function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** True when a URL path segment matches a variable entity ID, UUID, hex hash, or base64/high-entropy token. */
export function isDynamicSegment(segment: string): boolean {
  if (segment === "" || segment.startsWith(":")) {
    return false;
  }
  const decoded = safeDecodeSegment(segment);
  return (
    UUID_SEGMENT.test(decoded) ||
    NUMERIC_ID_SEGMENT.test(decoded) ||
    HEX_HASH_SEGMENT.test(decoded) ||
    PREFIXED_TOKEN_SEGMENT.test(decoded) ||
    PADDED_BASE64_SEGMENT.test(decoded) ||
    HIGH_ENTROPY_TOKEN_SEGMENT.test(decoded)
  );
}

function singularizeWord(word: string): string {
  if (word.length > 3 && word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.length > 4 && /(?:ches|shes|xes|zes|ses)$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 2 && word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

/** Infers a deterministic camelCase parameter name from the preceding path segment (or fallback). */
export function inferParamName(precedingSegment?: string, usedNames: ReadonlySet<string> = new Set()): string {
  let base = "";
  if (precedingSegment !== undefined && precedingSegment !== "" && !precedingSegment.startsWith(":")) {
    const slug = slugify(safeDecodeSegment(precedingSegment));
    const parts = slug.split("-").filter((part) => part !== "" && !/^\d+$/.test(part));
    if (parts.length > 0) {
      const normalized = parts.map((part, idx) => (idx === parts.length - 1 ? singularizeWord(part) : part));
      const camel = normalized
        .map((part, idx) => (idx === 0 ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
        .join("");
      if (/^[a-zA-Z_]/.test(camel)) {
        base = camel.endsWith("Id") ? camel : `${camel}Id`;
      }
    }
  }

  if (base === "") {
    if (!usedNames.has("id")) {
      return "id";
    }
    let index = 2;
    while (usedNames.has(`param${index.toString()}`)) {
      index += 1;
    }
    return `param${index.toString()}`;
  }

  let candidate = base;
  for (let suffix = 2; usedNames.has(candidate); suffix += 1) {
    candidate = `${base}${suffix.toString()}`;
  }
  return candidate;
}

/** Replaces dynamic URL path segments with deterministic `:param` placeholders. */
export function parameterizeRoute(pathname: string): string {
  const trimmed = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const clean = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  if (clean === "") {
    return "/";
  }
  const rawSegments = clean.split("/").filter((s) => s !== "");
  if (rawSegments.length === 0) {
    return "/";
  }
  const usedParams = new Set<string>();
  for (const seg of rawSegments) {
    if (seg.startsWith(":") && seg.length > 1) {
      usedParams.add(seg.slice(1));
    }
  }
  const out: string[] = [];
  for (let i = 0; i < rawSegments.length; i += 1) {
    const seg = rawSegments[i] ?? "";
    if (isDynamicSegment(seg)) {
      const prev = i > 0 ? rawSegments[i - 1] : undefined;
      const paramName = inferParamName(prev, usedParams);
      usedParams.add(paramName);
      out.push(`:${paramName}`);
    } else {
      out.push(seg);
    }
  }
  return `/${out.join("/")}`;
}

/** Screen id from the pathname or route pattern: `/login` -> `login`, `/` -> `home`. */
export function screenIdFromRoute(route: string): string {
  const slug = slugify(route);
  if (slug !== "") {
    return slug;
  }
  return route === "/" ? "home" : "screen";
}

/** sensitive = password input, secret autocomplete token, or a secret-looking name. */
export function detectSensitive(raw: Pick<RawElement, "name" | "inputType" | "autocomplete">): boolean {
  if (raw.inputType === "password") {
    return true;
  }
  const tokens = (raw.autocomplete ?? "").toLowerCase().split(/\s+/);
  if (tokens.some((token) => SENSITIVE_AUTOCOMPLETE.has(token))) {
    return true;
  }
  return SENSITIVE_NAME.test(raw.name);
}

/**
 * One id per element, in document order, in a single id space.
 * Empty slug -> `<role>-<n>` (n counts nameless elements of that role); collisions -> `-2`, `-3`, ...
 */
export function deriveIds(
  items: readonly { role: string; name: string }[],
  existingIds: ReadonlySet<string> = new Set(),
): string[] {
  const taken = new Set(existingIds);
  const namelessByRole = new Map<string, number>();
  return items.map(({ role, name }) => {
    let base = slugify(scrubMutableBadgeCounts(name));
    if (base === "") {
      const n = (namelessByRole.get(role) ?? 0) + 1;
      namelessByRole.set(role, n);
      base = `${slugify(role) || "element"}-${n.toString()}`;
    }
    let id = base;
    for (let suffix = 2; taken.has(id); suffix += 1) {
      id = `${base}-${suffix.toString()}`;
    }
    taken.add(id);
    return id;
  });
}

/** Content-named prose (a message, not a control): 5+ words ending in sentence punctuation. */
function isProse(raw: Pick<RawElement, "name" | "nameSource">): boolean {
  if (raw.nameSource !== "content") return false;
  const name = raw.name.trim();
  return name.split(/\s+/).length >= 5 && /[.!?…]$/.test(name);
}

// Transient per-message controls (EN + ES), compared accent-folded and lowercased.
const TRANSIENT_NAME_PREFIXES: readonly string[] = [
  "reaction", "view reactions", "quoted message", "reaccion", "ver reacciones", "mensaje citado",
];

const GENERIC_CHECKBOX_SLUGS: ReadonlySet<string> = new Set([
  "checkbox", "seleccionar", "select", "select-row", "toggle", "switch",
]);

const REACTION_EMOJI_PATTERN = /[\u{1F44D}\u{1F44E}\u{1F44F}\u{1F389}\u{1F38A}\u{2764}\u{1F9E1}\u{1F49B}\u{1F49A}\u{1F499}\u{1F49C}\u{1F525}\u{1F4A1}\u{1F602}\u{1F62E}\u{1F622}\u{1F64F}\u{1F64C}\u{1F91D}\u{2728}]/u;

const QUICK_REACTION_PHRASES: ReadonlySet<string> = new Set([
  "felicidades",
  "enhorabuena",
  "me alegro mucho por ti",
  "me alegro por ti",
  "gracias",
  "muchas gracias",
  "congratulations",
  "congrats",
  "happy for you",
  "so happy for you",
  "thank you",
  "thanks",
  "thumbs up",
  "heart",
  "like",
  "react",
  "reaccionar",
  "me gusta",
  "recomendar",
]);

const USER_CONTENT_EXTERNAL_HOSTS = /(?:^|\.)(?:drive\.google\.com|docs\.google\.com|meet\.google\.com|zoom\.us|teams\.microsoft\.com|dropbox\.com|calendly\.com|youtu\.be|youtube\.com)$/i;
const LITERAL_URL_NAME_PATTERN = /^(?:abrir\s+|open\s+)?https?:\/\/\S+/i;
const OUTBOUND_REDIRECTOR_PATTERN = /\/safety\/go\b|[?&]url=https?(?:%3A|:)/i;
const CONVERSATION_CONTAINER_NAME_PATTERN = /\b(?:conversaci[oó]n|conversaciones|mensajes|messages|messaging|chat|thread|hilo|bandeja)\b/i;
const CONVERSATION_ITEM_MENU_PATTERN = /^(?:abre la lista de opciones en tu conversacion con\b|open options list in your conversation with\b|mas opciones para el mensaje\b|more actions for message\b|more options for message\b|descartar empleo\b|dismiss job\b)/i;
const INLINE_ATTACHMENT_DOWNLOAD_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:kb|mb|gb|b)\b.*\b(?:descargar|download)\b/i;

function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().trim();
}

/** Name starts with a transient blocklist prefix (reactions, quoted messages). */
function isTransientName(name: string): boolean {
  const folded = foldText(name);
  return TRANSIENT_NAME_PREFIXES.some((prefix) => folded.startsWith(prefix));
}

/** Anonymous or generic checkboxes/switches inside list/feed/conversation viewports (R1). */
export function isAnonymousListCheckbox(
  raw: Pick<RawElement, "role" | "name" | "containerRole">,
): boolean {
  if (raw.role !== "checkbox" && raw.role !== "switch") {
    return false;
  }
  const slug = slugify(raw.name);
  if (slug === "") {
    return true;
  }
  if (raw.containerRole !== undefined && GENERIC_CHECKBOX_SLUGS.has(slug)) {
    return true;
  }
  return false;
}

/** Quick-reaction buttons and emoji affirmations (R2). */
export function isQuickReactionControl(
  raw: Pick<RawElement, "role" | "name">,
): boolean {
  if (!ACTION_ROLES.has(raw.role) && raw.role !== "checkbox") {
    return false;
  }
  const trimmed = raw.name.trim();
  if (trimmed === "") {
    return false;
  }
  const slug = slugify(trimmed);
  if (slug === "" && REACTION_EMOJI_PATTERN.test(trimmed)) {
    return true;
  }
  const folded = foldText(trimmed)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (QUICK_REACTION_PHRASES.has(folded)) {
    return true;
  }
  if (REACTION_EMOJI_PATTERN.test(trimmed)) {
    const wordCount = folded === "" ? 0 : folded.split(" ").length;
    if (wordCount <= 6) {
      return true;
    }
  }
  return false;
}

/** True when a container represents an informal dynamic conversation/message list (R5). */
export function isConversationContainer(
  raw: Pick<RawElement, "containerRole" | "containerName">,
): boolean {
  if (raw.containerRole === undefined) {
    return false;
  }
  if (DYNAMIC_CONTAINER_ROLES.has(raw.containerRole)) {
    return true;
  }
  if (
    (raw.containerRole === "list" || raw.containerRole === "region" || raw.containerRole === "grid" || raw.containerRole === "listbox") &&
    raw.containerName !== undefined &&
    CONVERSATION_CONTAINER_NAME_PATTERN.test(raw.containerName)
  ) {
    return true;
  }
  return false;
}

/** Per-message or per-list-item action menus and attachment download buttons (R5). */
export function isConversationItemControl(
  raw: Pick<RawElement, "role" | "name" | "occurrence" | "containerRole" | "containerName">,
): boolean {
  if (!ACTION_ROLES.has(raw.role)) {
    return false;
  }
  const folded = foldText(raw.name);
  if (CONVERSATION_ITEM_MENU_PATTERN.test(folded)) {
    return true;
  }
  if (INLINE_ATTACHMENT_DOWNLOAD_PATTERN.test(folded)) {
    return true;
  }
  if (
    (folded === "mas opciones" || folded === "more options" || folded === "more actions" || folded === "mas acciones") &&
    (raw.occurrence >= 1 || isConversationContainer(raw))
  ) {
    return true;
  }
  return false;
}

/** External links pasted inside user messages/comments or outbound redirectors (R4). */
export function isUserContentExternalLink(
  raw: Pick<RawElement, "name" | "href" | "containerRole" | "containerName">,
  classified: { href: string; external: boolean },
  pageUrl: string,
): boolean {
  if (LITERAL_URL_NAME_PATTERN.test(raw.name.trim())) {
    return true;
  }
  const rawHref = raw.href ?? "";
  if (OUTBOUND_REDIRECTOR_PATTERN.test(rawHref)) {
    return true;
  }
  if (classified.external) {
    if (isConversationContainer(raw)) {
      return true;
    }
    try {
      const targetHost = new URL(rawHref, pageUrl).hostname;
      if (USER_CONTENT_EXTERNAL_HOSTS.test(targetHost)) {
        return true;
      }
    } catch {
      // ignore unparsable URL
    }
  }
  return false;
}

type Kind = "field" | "action" | "link";

function kindOf(role: string): Kind | undefined {
  if (FIELD_ROLES.has(role)) return "field";
  if (ACTION_ROLES.has(role)) return "action";
  if (role === "link") return "link";
  return undefined;
}

// Internal -> href as written. External -> origin only. Non-http(s) or unparsable -> undefined (skipped).
function classifyHref(href: string, pageUrl: string, appOrigin: string): { href: string; external: boolean } | undefined {
  let resolved: URL;
  try {
    resolved = new URL(href, pageUrl);
  } catch {
    return undefined;
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return undefined;
  }
  if (resolved.origin === new URL(appOrigin).origin) {
    return { href, external: false };
  }
  return { href: resolved.origin, external: true };
}

function locatorOf(raw: RawElement): Locator {
  return { role: raw.role, name: raw.name, occurrence: raw.occurrence };
}

export function learnScreen(raw: readonly RawElement[], page: LearnPage, options: LearnOptions = {}): Screen {
  const route = parameterizeRoute(new URL(page.url).pathname);
  const submitNames = options.submitNames ?? new Set<string>();

  // Classify first (dropping ignored roles and hrefless links) so ids are assigned over survivors only.
  const allEntries: { raw: RawElement; kind: Kind; link?: { href: string; external: boolean } }[] = [];
  for (const element of raw) {
    const kind = kindOf(element.role);
    if (kind === undefined) continue;
    const dynamic = isConversationContainer(element);
    if (!dynamic && isProse(element)) continue;
    if (isTransientName(element.name)) continue;
    if (isAnonymousListCheckbox(element)) continue;
    if (isQuickReactionControl(element)) continue;
    if (isConversationItemControl(element)) continue;
    if (kind === "link") {
      const link = element.href === undefined ? undefined : classifyHref(element.href, page.url, page.appOrigin);
      if (link !== undefined && !isUserContentExternalLink(element, link, page.url)) {
        allEntries.push({ raw: element, kind, link });
      }
      continue;
    }
    allEntries.push({ raw: element, kind });
  }

  // Detect patterns: repeating elements within the same semantic container
  const groups = new Map<string, typeof allEntries>();
  for (const entry of allEntries) {
    if (entry.raw.containerRole) {
      const groupKey = `${entry.raw.containerRole}\t${entry.raw.containerName || ""}\t${entry.raw.role}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = [];
        groups.set(groupKey, group);
      }
      group.push(entry);
    }
  }

  const patterns: EntityPattern[] = [];
  const patternKeys = new Set<string>();
  const patternIds = new Set<string>();

  for (const [key, group] of groups.entries()) {
    const [containerRole = "", containerName = "", itemRole = ""] = key.split("\t");
    const isListContainer = ["list", "grid", "rowgroup", "treegrid", "table", "feed"].includes(containerRole);
    const dynamic = isConversationContainer({ containerRole, containerName });

    if (dynamic || group.length >= 2 || (group.length === 1 && isListContainer)) {
      patternKeys.add(key);
      let baseId = slugify(`${containerName || containerRole}-item`);
      if (!baseId) baseId = "item";
      let id = baseId;
      for (let suffix = 2; patternIds.has(id); suffix += 1) {
        id = `${baseId}-${suffix.toString()}`;
      }
      patternIds.add(id);

      patterns.push({
        id,
        containerRole,
        ...(containerName ? { containerName } : {}),
        itemRole,
        actionTarget: `@${id}`,
        ...(dynamic ? { dynamicChildren: true } : {}),
      });
    }
  }

  // Filter out elements that are captured by patterns
  const entries: typeof allEntries = [];
  for (const entry of allEntries) {
    let isPattern = false;
    if (entry.raw.containerRole) {
      const groupKey = `${entry.raw.containerRole}\t${entry.raw.containerName || ""}\t${entry.raw.role}`;
      if (patternKeys.has(groupKey)) {
        isPattern = true;
      }
    }
    if (!isPattern) {
      entries.push(entry);
    }
  }

  const ids = deriveIds(entries.map((entry) => entry.raw), options.existingIds);
  const fields: ScreenField[] = [];
  const actions: ScreenAction[] = [];
  const links: ScreenLink[] = [];
  const findings: A11yFinding[] = [];
  const firstWithKey = new Map<string, string>();
  const submitIndexes: number[] = [];

  entries.forEach((entry, index) => {
    const element = entry.raw;
    const id = ids[index] ?? "";
    if (entry.kind === "field") {
      const sensitive = detectSensitive(element);
      fields.push({
        id,
        role: element.role,
        name: element.name,
        nameSource: element.nameSource,
        ...(element.inputType === undefined ? {} : { inputType: element.inputType }),
        required: false, // collector does not report `required`
        sensitive,
        agentFillable: !sensitive,
        locator: locatorOf(element),
        ...(element.dialog !== undefined ? { dialog: element.dialog } : {}),
        ...(element.container !== undefined ? { container: element.container } : {}),
      });
    } else if (entry.kind === "action") {
      const submit = element.buttonType === "submit" || submitNames.has(element.name);
      const toggle = !submit && TOGGLE_NAME.test(element.name);
      if (submit) submitIndexes.push(actions.length);
      actions.push({
        id,
        role: element.role,
        name: element.name,
        nameSource: element.nameSource,
        kind: submit ? "submit" : toggle ? "toggle" : "button",
        effect: submit ? "submit" : toggle ? "ui-state" : "none",
        locator: locatorOf(element),
        ...(element.dialog !== undefined ? { dialog: element.dialog } : {}),
        ...(element.container !== undefined ? { container: element.container } : {}),
      });
    } else if (entry.link !== undefined) {
      links.push({ id, name: element.name, href: entry.link.href, external: entry.link.external, locator: locatorOf(element) });
    }

    if (entry.kind === "field" && element.nameSource === "placeholder") {
      findings.push({
        code: "name-from-placeholder-only",
        target: `@${id}`,
        detail: `"${element.name}" comes from the placeholder only; add a label`,
        wcag: "3.3.2",
      });
    }
    if (element.name === "") {
      findings.push({ code: "missing-accessible-name", target: `@${id}`, detail: `${element.role} has no accessible name`, wcag: "4.1.2" });
    } else {
      const key = `${element.role}\t${element.name}`;
      const first = firstWithKey.get(key);
      if (first === undefined) {
        firstWithKey.set(key, id);
      } else {
        findings.push({ code: "duplicate-name", target: `@${id}`, detail: `same role and name as @${first}` });
      }
    }
  });

  const requires = fields.filter((field) => !OPTIONAL_FIELD_ROLES.has(field.role)).map((field) => field.id);
  for (const index of submitIndexes) {
    const action = actions[index];
    if (action !== undefined && requires.length > 0) {
      action.requires = [...requires];
    }
  }

  // Cluster dialog elements into opens branches under matching triggering action
  const dialogTitles = new Set<string>();
  for (const f of fields) {
    if (f.dialog !== undefined) dialogTitles.add(f.dialog);
  }
  for (const a of actions) {
    if (a.dialog !== undefined) dialogTitles.add(a.dialog);
  }

  const clusteredFieldIds = new Set<string>();
  const clusteredActionIds = new Set<string>();

  for (const dialogTitle of dialogTitles) {
    const dLower = dialogTitle.toLowerCase();
    const branch: OpensBranch = {
      id: slugify(`dialog-${dialogTitle}`),
      type: "dialog",
      title: dialogTitle,
    };
    const dialogFields = fields.filter((f) => f.dialog === dialogTitle);
    const dialogActions = actions.filter((a) => a.dialog === dialogTitle);
    if (dialogFields.length > 0) branch.fields = dialogFields;
    if (dialogActions.length > 0) branch.actions = dialogActions;

    let attached = false;
    if (options.lastAction?.id !== undefined) {
      attached = nestBranchIntoActionList(actions, options.lastAction.id, branch);
    }
    if (!attached && options.lastAction?.name !== undefined) {
      attached = nestBranchIntoActionList(actions, options.lastAction.name, branch);
    }
    if (!attached) {
      const trigger = actions.find(
        (a) =>
          a.dialog === undefined &&
          (a.name.toLowerCase().includes(dLower) || dLower.includes(a.name.toLowerCase())),
      );
      if (trigger !== undefined) {
        if (trigger.opens === undefined) {
          trigger.opens = branch;
        } else {
          trigger.opens = mergeOpensBranch(trigger.opens, branch);
        }
        attached = true;
      }
    }
    if (!attached) {
      // If trigger could not be matched, encapsulate dialog in an action branch so modal controls don't pollute root
      const virtualId = slugify(`modal-${dialogTitle}`);
      const virtualTrigger: ScreenAction = {
        id: virtualId,
        role: "button",
        name: dialogTitle,
        kind: "button",
        effect: "ui-state",
        locator: { role: "button", name: dialogTitle },
        opens: branch,
      };
      actions.push(virtualTrigger);
    }
    dialogFields.forEach((f) => clusteredFieldIds.add(f.id));
    dialogActions.forEach((a) => clusteredActionIds.add(a.id));
  }

  const rootFields = fields.filter((f) => !clusteredFieldIds.has(f.id));
  const rootActions = actions.filter((a) => !clusteredActionIds.has(a.id));

  const screen: Screen = {
    id: options.screenId ?? screenIdFromRoute(route),
    route,
    title: page.title,
    access: options.access ?? "unknown",
    fingerprint: "",
    observedAt: (options.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
    fields: rootFields,
    actions: rootActions,
    links,
    flows: [],
    ...(patterns.length > 0 ? { patterns } : {}),
    ...(findings.length > 0 ? { a11y: findings } : {}),
  };
  screen.fingerprint = fingerprintOf(screenElements(screen));
  return screen;
}

function nestBranchIntoActionList(
  actions: ScreenAction[],
  targetActionIdOrName: string,
  branch: OpensBranch,
): boolean {
  const targetLower = targetActionIdOrName.toLowerCase();
  for (const a of actions) {
    if (a.id.toLowerCase() === targetLower || a.name.toLowerCase() === targetLower) {
      if (a.opens === undefined) {
        a.opens = branch;
      } else {
        a.opens = mergeOpensBranch(a.opens, branch);
      }
      return true;
    }
    if (a.opens?.actions && nestBranchIntoActionList(a.opens.actions, targetActionIdOrName, branch)) {
      return true;
    }
  }
  return false;
}
