// MCP tool table (spec 006, T001-T003, spec 012). Thin adapter: every handler calls the shared tools layer
// (src/tools/); no browser, gate or ref logic lives here.
// Page content is untrusted: descriptions are static strings, results echo only what tools print.
import type { Backend } from "../backend/backend.js";
import { FirefoxNotFoundError } from "../browser/pwa-runtime.js";
import {
  ACTION_HINTS,
  actionOutcome,
  actTool,
  authTool as runAuthTool,
  statusTool,
  clickTool,
  configTool,
  discoverTool,
  downloadTool,
  extractTool,
  findTool as runFindTool,
  invalid,
  isDryRun,
  learnTool as runLearnTool,
  openTool,
  READONLY_HINTS,
  runtimeInstallTool,
  screenshotTool as runScreenshotTool,
  snapshotTool,
  uploadTool,
  waitTool as runWaitTool,
  fillTool,
  type BackendFactory,
  type ScreenSource,
  type SemanticContext,
  type ToolAnnotations,
  type ToolContext,
  type ToolOutcome,
} from "../tools/index.js";

export {
  ACTION_HINTS,
  actionOutcome,
  invalid,
  isDryRun,
  READONLY_HINTS,
  type BackendFactory,
  type ScreenSource,
  type SemanticContext,
  type ToolAnnotations,
  type ToolContext,
  type ToolOutcome,
};

export const EXTRACT_INLINE_CAP = 100;

export const RUNTIME_INSTALL_PROMPT =
  "pwa-nav needs Firefox to open this app and none was found. Download the official Firefox from Mozilla " +
  "(about 95 MB) into pwa-nav's own folder? It is not installed system-wide and does not change your default browser.";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: ToolAnnotations;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutcome>;
}

const TARGET_PATTERN = "^@[a-z0-9]+(-[a-z0-9]+)*$";

const TARGET_PROP = {
  type: "string",
  pattern: TARGET_PATTERN,
  description: "Semantic target from the screen map, such as @sign-in. Use instead of ref.",
};
const SNAPSHOT_ID_PROP = { type: "string", description: "Optional snapshotId. Defaults to the latest snapshot." };
const REF_PROP = { type: "string", minLength: 1, description: "Element ref (eN) or visible text from the snapshot." };

const TARGET_ALTERNATIVES = [
  { required: ["target"], properties: { target: true } },
  { required: ["ref"], properties: { ref: true, snapshotId: true } },
];

export function semanticContext(ctx: ToolContext, backend: Backend): SemanticContext {
  if (ctx.mode === "offline") {
    throw invalid("semantic targets need the live backend (--backend bidi).");
  }
  return { ...ctx.screens, backend, armed: ctx.armed };
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function flag(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true;
}

function pickTarget(args: Record<string, unknown>): { target: string } | { snapshotId?: string; ref: string } {
  const target = str(args, "target");
  const snapshotId = str(args, "snapshotId");
  const ref = str(args, "ref");
  if (target !== undefined) {
    if (ref !== undefined) {
      throw invalid("pass either target or ref, not both.");
    }
    return { target };
  }
  if (ref !== undefined) {
    if (ref.startsWith("@")) {
      return { target: ref };
    }
    return { ...(snapshotId !== undefined ? { snapshotId } : {}), ref };
  }
  throw invalid("pass target (@id or visible text) or ref (eN).");
}

const open: ToolDef = {
  name: "browser_open",
  description:
    "Open or navigate the browser window to any target website, URL, domain, or web application. " +
    "Attaches directly to the user's authenticated browser session (preserving cookies and logins) or launches the browser runtime automatically. " +
    "After navigating, call browser_snapshot to inspect the page, and use browser_fill and browser_click to interact with in-page search boxes, forms, and links.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        minLength: 1,
        description:
          "Target website or web app to navigate to. Valid formats: full HTTP(S) URL (e.g. 'https://www.linkedin.com'), domain (e.g. 'linkedin.com', 'github.com'), or registered app slug / canonical alias (e.g. 'notebook', 'linkedin', 'mercadona', 'google', 'github', 'twitter', 'x'). Pass a URL, domain, or alias (not a raw search query; to search inside a page, use browser_fill on its search input).",
      },
      launch: { type: "boolean", description: "Launch the browser runtime with the WebDriver BiDi debugging port if not already running." },
      allowOrigin: { type: "boolean", description: "Add this URL's origin to the allow-list after a successful navigation." },
      cacheDir: { type: "string", description: "Optional per-call cache directory override." },
      workspaceDir: { type: "string", description: "Optional per-call workspace directory override." },
    },
    required: ["url"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args, ctx) {
    const url = str(args, "url") ?? "";
    const launch = flag(args, "launch");
    const allowOrigin = flag(args, "allowOrigin");
    try {
      return await openTool({ url, launch, allowOrigin, cacheDir: str(args, "cacheDir"), workspaceDir: str(args, "workspaceDir") }, ctx);
    } catch (error) {
      // No Firefox: ask the human (elicitation) before downloading; otherwise the error hints browser_install_runtime / pwa_install_runtime.
      if (!launch || !(error instanceof FirefoxNotFoundError) || ctx.confirm === undefined) throw error;
      if (!(await ctx.confirm(RUNTIME_INSTALL_PROMPT))) throw error;
      await runtimeInstallTool({ ...(ctx.runtimeInstaller === undefined ? {} : { installer: ctx.runtimeInstaller }) });
      return openTool({ url, launch, allowOrigin }, ctx);
    }
  },
};

const installRuntime: ToolDef = {
  name: "browser_install_runtime",
  description:
    "Download the official Mozilla Firefox runtime (about 95 MB) into browser-nav's isolated folder so websites and web apps can be launched for direct browser automation. " +
    "Only call this after browser_open failed with 'Firefox was not found' and the user agreed to the download. " +
    "Nothing is installed system-wide; the default browser is not changed. Re-running updates it.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  async handler(_args, ctx) {
    return runtimeInstallTool({ ...(ctx.runtimeInstaller === undefined ? {} : { installer: ctx.runtimeInstaller }) });
  },
};

const snapshot: ToolDef = {
  name: "browser_snapshot",
  description:
    "MANDATORY FIRST STEP & STATE INSPECTION: Inspect the active browser window in text (live DOM/accessibility tree) for direct browser automation on any website or web app. " +
    "DO NOT take screenshots to discover elements; use this tool instead (preserves tokens and supports text-only agents).\n" +
    "- Automatically updates and syncs .agent/apps/<appSlug>/screens.json on every call, nesting opened dialogs/modals directly into actions.\n" +
    "- Use mode screen: true to return the compact screen-map view with semantic @id targets inline.\n" +
    "- Optional filters: query, role. Optional modes: screen (view only), learn (force re-learn).",
  inputSchema: {
    type: "object",
    properties: {
      all: { type: "boolean", description: "Full tree (headings, images) instead of interactive elements only." },
      screen: { type: "boolean", description: "Return the compact screen-map view inline instead of collecting a raw snapshot." },
      learn: { type: "boolean", description: "Learn current web page screen into .agent/apps/<appSlug>/screens.json (eliminates expiring eN refs)." },
      query: { type: "string", description: "Optional substring filter to return matching elements inline in the output." },
      role: { type: "string", description: "Optional role filter (e.g. 'button', 'textbox') to return matching elements." },
      locale: { type: "string", description: "BCP 47 tag (e.g. 'es' or 'en') for new map. Defaults to 'es'." },
      appId: { type: "string", description: "Optional lowercase site/app ID slug (e.g. 'linkedin-com', 'mercadona')." },
      appName: { type: "string", description: "Optional human-readable website or app name." },
      access: { enum: ["public", "authenticated", "unknown"], description: "Screen access level (default: public)." },
      prune: { type: "boolean", description: "Prune missing elements from existing map (default: false)." },
      cacheDir: { type: "string", description: "Optional per-call cache directory override." },
      workspaceDir: { type: "string", description: "Optional per-call workspace directory override." },
      rawTree: { type: "string", description: "Optional raw ARIA tree input for testing/offline." },
      url: { type: "string", description: "Optional URL for offline snapshot." },
      title: { type: "string", description: "Optional title for offline snapshot." },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    return snapshotTool(
      {
        all: flag(args, "all"),
        screen: flag(args, "screen"),
        learn: flag(args, "learn"),
        query: str(args, "query"),
        role: str(args, "role"),
        locale: str(args, "locale"),
        appId: str(args, "appId"),
        appName: str(args, "appName"),
        access: str(args, "access"),
        prune: flag(args, "prune"),
        rawTree: str(args, "rawTree"),
        url: str(args, "url"),
        title: str(args, "title"),
        cacheDir: str(args, "cacheDir"),
        workspaceDir: str(args, "workspaceDir"),
      },
      ctx,
    );
  },
};

const click: ToolDef = {
  name: "browser_click",
  description:
    "Click any button, link, or interactive control in the live browser window by semantic target (@id), visible text, or ref (eN). " +
    "Sensitive buttons (such as checkout/payment) are refused. Direct live execution on the browser (armed by default).",
  inputSchema: {
    type: "object",
    properties: {
      snapshotId: SNAPSHOT_ID_PROP,
      ref: REF_PROP,
      target: TARGET_PROP,
    },
    anyOf: TARGET_ALTERNATIVES,
    additionalProperties: false,
  },
  annotations: ACTION_HINTS,
  async handler(args, ctx) {
    const picked = pickTarget(args);
    if ("target" in picked) {
      return clickTool({ target: picked.target, dryRun: isDryRun(ctx) }, ctx);
    }
    return clickTool({ ref: picked.ref, snapshotId: picked.snapshotId, dryRun: isDryRun(ctx) }, ctx);
  },
};

const fill: ToolDef = {
  name: "browser_fill",
  description:
    "Type text into any input field, search box, textarea, or rich contenteditable editor in the live browser window by semantic target (@id), visible text, or ref (eN). " +
    "Use this tool to enter search queries or form data on the currently loaded web page. " +
    "Sensitive fields (passwords) are refused. Direct live execution on the browser (armed by default).",
  inputSchema: {
    type: "object",
    properties: {
      snapshotId: SNAPSHOT_ID_PROP,
      ref: REF_PROP,
      target: TARGET_PROP,
      text: { type: "string", description: "Text to type into the input or search field." },
    },
    required: ["text"],
    anyOf: TARGET_ALTERNATIVES,
    additionalProperties: false,
  },
  annotations: ACTION_HINTS,
  async handler(args, ctx) {
    const picked = pickTarget(args);
    const text = str(args, "text") ?? "";
    if ("target" in picked) {
      return fillTool({ target: picked.target, text, dryRun: isDryRun(ctx) }, ctx);
    }
    return fillTool({ ref: picked.ref, text, snapshotId: picked.snapshotId, dryRun: isDryRun(ctx) }, ctx);
  },
};

const download: ToolDef = {
  name: "browser_download",
  description:
    "Download a remote media asset or extract an in-page SVG/image/video from the live browser to disk. " +
    "Never runs automatically; execute strictly on explicit request. " +
    "Pass 'url' to download directly, or 'target' / 'ref' to extract an in-page element.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Direct URL of the media, image, or video to download.",
      },
      target: TARGET_PROP,
      ref: REF_PROP,
      out: {
        type: "string",
        description: "Optional output file or directory destination (defaults to ./downloads/<filename>).",
      },
    },
    additionalProperties: false,
  },
  annotations: ACTION_HINTS,
  async handler(args, ctx) {
    const url = typeof args["url"] === "string" ? args["url"] : undefined;
    const target = typeof args["target"] === "string" ? args["target"] : undefined;
    const ref = typeof args["ref"] === "string" ? args["ref"] : undefined;
    const out = typeof args["out"] === "string" ? args["out"] : undefined;

    return downloadTool({ url, target, ref, out, dryRun: !ctx.armed }, ctx);
  },
};

const upload: ToolDef = {
  name: "browser_upload",
  description:
    "Upload one or more local files to a file input (<input type=\"file\">) in the live browser window by semantic target (@id), visible text, or ref (eN). " +
    "Files must be inside allowed directories (workspace or .agent/). Direct live execution on the browser (armed by default).",
  inputSchema: {
    type: "object",
    properties: {
      snapshotId: SNAPSHOT_ID_PROP,
      ref: REF_PROP,
      target: TARGET_PROP,
      files: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
        description: "Local file paths to upload.",
      },
      file: {
        type: "string",
        minLength: 1,
        description: "Single local file path to upload (convenience alias for files: [path]).",
      },
    },
    anyOf: TARGET_ALTERNATIVES,
    additionalProperties: false,
  },
  annotations: ACTION_HINTS,
  async handler(args, ctx) {
    const picked = pickTarget(args);
    const rawFiles = args["files"];
    const rawFile = args["file"];
    let files: string[] = [];
    if (Array.isArray(rawFiles) && rawFiles.length > 0) {
      files = rawFiles.filter((f): f is string => typeof f === "string" && f.length > 0);
    } else if (typeof rawFile === "string" && rawFile.length > 0) {
      files = [rawFile];
    } else {
      throw invalid("missing files (expected string array 'files' or string 'file').");
    }
    if ("target" in picked) {
      return uploadTool({ target: picked.target, files, dryRun: isDryRun(ctx) }, ctx);
    }
    return uploadTool({ ref: picked.ref, files, snapshotId: picked.snapshotId, dryRun: isDryRun(ctx) }, ctx);
  },
};

const screenshotToolDef: ToolDef = {
  name: "browser_screenshot",
  description:
    "DO NOT USE FOR NAVIGATION, DISCOVERY, OR STATE INSPECTION. " +
    "Capture a visual screenshot of the browser window ONLY when explicitly requested by the user. " +
    "Many agents cannot process images, and screenshots waste massive amounts of tokens. " +
    "To check if an action succeeded, discover new elements, or inspect popups/dialogs, ALWAYS call browser_snapshot instead.",
  inputSchema: {
    type: "object",
    properties: {
      outPath: {
        type: "string",
        description: "Optional destination path for the screenshot PNG (defaults to .agent/screenshot.png).",
      },
      path: {
        type: "string",
        description: "Optional destination path for the screenshot PNG (alias for outPath).",
      },
      format: {
        enum: ["png", "jpeg", "webp"],
        description: "Image format (default: png).",
      },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const outPath = str(args, "outPath") ?? str(args, "path");
    const rawFormat = str(args, "format");
    let format: "png" | "jpeg" | "webp" | undefined;
    if (rawFormat === "png" || rawFormat === "jpeg" || rawFormat === "webp") {
      format = rawFormat;
    }
    return runScreenshotTool({ outPath, format }, ctx);
  },
};

const extract: ToolDef = {
  name: "browser_extract",
  description:
    "Read-only: dump formatted element list or page links from a browser snapshot for bulk reading. " +
    "DO NOT USE TO FIND BUTTONS OR INPUTS TO CLICK/FILL: use 'browser_find' instead. " +
    "Supports offset pagination. snapshotId is optional and defaults to the latest snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      snapshotId: SNAPSHOT_ID_PROP,
      mode: { enum: ["all", "text", "links"], description: "all: all matching elements; text: named elements and values; links: links and buttons." },
      query: { type: "string", description: "Case-insensitive substring to filter element name, value, or ref." },
      role: { type: "string", description: "Filter elements by role (e.g. 'button', 'textbox', 'link')." },
      offset: { type: "integer", minimum: 0, description: "Starting element offset for pagination (default: 0)." },
      limit: { type: "integer", minimum: 1, maximum: EXTRACT_INLINE_CAP, description: `Max lines to return (default: ${EXTRACT_INLINE_CAP.toString()}).` },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const snapshotId = str(args, "snapshotId");
    const rawMode = args["mode"];
    const mode = rawMode === "links" ? "links" : rawMode === "text" ? "text" : "all";
    const query = str(args, "query");
    const role = str(args, "role");
    const offset = typeof args["offset"] === "number" ? Math.max(0, args["offset"]) : 0;
    const limit = typeof args["limit"] === "number" ? Math.min(EXTRACT_INLINE_CAP, Math.max(1, args["limit"])) : EXTRACT_INLINE_CAP;
    return extractTool({ snapshotId, mode, query, role, offset, limit }, ctx);
  },
};

const findToolDef: ToolDef = {
  name: "browser_find",
  description:
    "PRIMARY ELEMENT LOCATOR: Find buttons, textboxes, placeholders, links, or modal controls in the live browser snapshot. " +
    "Searches across element name, value, placeholder (including rich contenteditable editors), dialog, and container. " +
    "Pass inDialog: true to target the active modal/popup. Always use this instead of browser_extract when looking for elements to interact with.",
  inputSchema: {
    type: "object",
    properties: {
      snapshotId: SNAPSHOT_ID_PROP,
      query: { type: "string", description: "Case-insensitive search term (matches name, placeholder, value, dialog title, ref)." },
      role: { type: "string", description: "Filter elements by role (e.g. 'textbox', 'button', 'link')." },
      inDialog: { type: "boolean", description: "When true, returns only elements inside the active modal/dialog." },
      offset: { type: "integer", minimum: 0, description: "Starting offset for pagination (default: 0)." },
      limit: { type: "integer", minimum: 1, maximum: EXTRACT_INLINE_CAP, description: `Max lines to return (default: ${EXTRACT_INLINE_CAP.toString()}).` },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const snapshotId = str(args, "snapshotId");
    const query = str(args, "query");
    const role = str(args, "role");
    const inDialog = args["inDialog"] === true;
    const offset = typeof args["offset"] === "number" ? Math.max(0, args["offset"]) : 0;
    const limit = typeof args["limit"] === "number" ? Math.min(EXTRACT_INLINE_CAP, Math.max(1, args["limit"])) : EXTRACT_INLINE_CAP;
    return runFindTool({ snapshotId, query, role, inDialog, offset, limit }, ctx);
  },
};

const act: ToolDef = {
  name: "browser_act",
  description:
    "Execute a batch of browser actions in a single turn (ideal for search: fill search input + click search button, or submitting forms). " +
    "Semantic ops without snapshotId: click:@id, fill:@id=<text>, upload:@id=<path>, flow:<id> with inputs. " +
    "Plain ops with snapshotId: click:<ref>, fill:<ref>=<text>, upload:<ref>=<path>. Do not mix the two. " +
    "Direct live execution on the browser (armed by default); human-only flows are refused.",
  inputSchema: {
    type: "object",
    properties: {
      snapshotId: SNAPSHOT_ID_PROP,
      ops: { type: "array", minItems: 1, items: { type: "string", minLength: 1 }, description: "Browser operations to run in order (e.g. ['fill:@search=query', 'click:@submit'])." },
      inputs: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Flow inputs (key: value) for the single flow:<id> op.",
      },
    },
    required: ["ops"],
    additionalProperties: false,
  },
  annotations: ACTION_HINTS,
  async handler(args, ctx) {
    const rawOps = args["ops"];
    if (!Array.isArray(rawOps) || rawOps.length === 0) {
      throw invalid("missing ops (expected non-empty array of operations, e.g. ['click:@btn'] or ['fill:@input=text']).");
    }
    const ops = (rawOps as string[]).slice();
    const inputs = args["inputs"] as Record<string, string> | undefined;
    const snapshotId = str(args, "snapshotId");
    return actTool({ ops, inputs, snapshotId, dryRun: isDryRun(ctx) }, ctx);
  },
};

const learnToolDef: ToolDef = {
  name: "screen_learn",
  description:
    "Learn and register/update the active browser page into the persistent screen map (.agent/apps/<appSlug>/screens.json). " +
    "Generates stable semantic @id targets (e.g. @search-input, @cart-btn) for any website or web app and eliminates expiring eN refs. " +
    "Call this whenever you encounter an unmapped screen (exit code 13) or when page structure changes.",
  inputSchema: {
    type: "object",
    properties: {
      locale: { type: "string", description: "BCP 47 language tag (e.g. 'es' or 'en'). Defaults to 'es' for new maps." },
      appId: { type: "string", description: "Optional lowercase site/app slug (e.g. 'linkedin-com', 'mercadona'). Defaults to normalized hostname." },
      appName: { type: "string", description: "Optional human-readable website or app name." },
      access: { enum: ["public", "authenticated", "unknown"], description: "Access level (default: public)." },
      prune: { type: "boolean", description: "Prune missing elements from existing map (default: false)." },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const locale = str(args, "locale") ?? "es";
    const appId = str(args, "appId");
    const appName = str(args, "appName");
    const access = str(args, "access");
    const prune = flag(args, "prune");
    return runLearnTool({ locale, appId, appName, access, prune }, ctx);
  },
};

const waitToolDef: ToolDef = {
  name: "browser_wait",
  description:
    "Wait for a specific UI element, DOM state change, or background async process in the live browser (e.g. AI answer, fast research, audio generation) to complete. " +
    "State can be 'visible' (default), 'hidden' (e.g. wait for 'Generando...' notice to disappear), or 'enabled'.",
  inputSchema: {
    type: "object",
    properties: {
      target: { type: "string", description: "Semantic target (@id), element ref (eN), or visible text to watch in the browser." },
      query: { type: "string", description: "Substring of text to search for on the page." },
      state: { enum: ["visible", "hidden", "enabled"], description: "DOM condition to wait for (default: visible)." },
      timeoutMs: { type: "integer", minimum: 250, maximum: 60000, description: "Maximum wait time in ms (default: 15000)." },
      intervalMs: { type: "integer", minimum: 50, maximum: 5000, description: "Polling interval in ms (default: 1000)." },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const target = str(args, "target");
    const query = str(args, "query");
    const state = (str(args, "state") as "visible" | "hidden" | "enabled" | undefined) ?? "visible";
    const timeoutMs = typeof args["timeoutMs"] === "number" ? args["timeoutMs"] : undefined;
    const intervalMs = typeof args["intervalMs"] === "number" ? args["intervalMs"] : undefined;
    return runWaitTool({ target, query, state, timeoutMs, intervalMs }, ctx);
  },
};

const authToolDef: ToolDef = {
  name: "browser_auth",
  description:
    "Assisted authentication workflow for login-walled websites and web apps (such as Google NotebookLM, LinkedIn, or Cloudflare-protected sites) where anti-bot defenses block automated login. " +
    "By default, launches a clean browser window for user login, monitors until authentication completes, cleanly closes the window, and relaunches in WebDriver BiDi debug mode on port 9222. " +
    "Action 'status' is read-only and launches nothing: it reports whether the site's stored auth cookies are present, expired, or missing (verdict authenticated|expired|unauthenticated|no_profile).",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        enum: ["status"],
        description: "Optional. 'status': read-only session health check without launching the browser.",
      },
      cookies: {
        type: "array",
        items: { type: "string" },
        description: "status only: auth cookie names to check instead of the built-in name heuristic.",
      },
      app: {
        type: "string",
        description: "Target website domain, URL, or app slug/alias (e.g. 'notebook', 'linkedin.com'). Defaults to the active site profile.",
      },
      timeoutMs: {
        type: "integer",
        description: "Max wait time in ms for user login completion (default: 180000).",
      },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args, ctx) {
    const action = str(args, "action");
    const app = str(args, "app");
    const timeoutMs = typeof args["timeoutMs"] === "number" ? args["timeoutMs"] : undefined;
    if (action === "status") {
      const cookies = Array.isArray(args["cookies"]) ? args["cookies"].filter((c) => typeof c === "string") : undefined;
      return statusTool(
        { ...(app === undefined ? {} : { app }), ...(cookies === undefined ? {} : { cookies }) },
        ctx.screens.cacheDir === undefined ? {} : { cacheDir: ctx.screens.cacheDir },
      );
    }
    return runAuthTool({ app, timeoutMs });
  },
};

const discoverToolDef: ToolDef = {
  name: "browser_discover",
  description:
    "Zero-token browser history discovery tool: queries the site profile's places.sqlite to discover candidate routes " +
    "and enrich the screen map's unmapped[] list without launching the browser or BiDi.",
  inputSchema: {
    type: "object",
    properties: {
      app: {
        type: "string",
        description: "Website domain, URL, or app slug (e.g. 'linkedin.com', 'mercadona').",
      },
      write: {
        type: "boolean",
        description: "Persist discovered candidate routes into the screen map's unmapped[] array (default: false / dry-run).",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 200,
        description: "Maximum number of candidate routes to return (default: 50).",
      },
    },
    required: ["app"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const app = str(args, "app");
    const write = flag(args, "write");
    const limit = typeof args["limit"] === "number" ? args["limit"] : undefined;
    return discoverTool(
      {
        app,
        write,
        limit,
        screenMap: ctx.screens.screenMap,
        screensDir: ctx.screens.screensDir,
      },
      ctx.screens.cacheDir === undefined ? {} : { cacheDir: ctx.screens.cacheDir },
    );
  },
};

const configToolDef: ToolDef = {
  name: "browser_config",
  description:
    "Inspect or update browser automation runtime storage configuration (active cache directory, screens directory, workspace directory, and fallback mode) without restarting the MCP server.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        enum: ["get", "set"],
        description: "Action to perform: 'get' to inspect current configuration, 'set' to update dynamic paths for the session. Defaults to 'get' if no paths provided.",
      },
      cacheDir: {
        type: "string",
        description: "Explicit cache directory path to set for this session (stores apps/, session.json, allow.json).",
      },
      workspaceDir: {
        type: "string",
        description: "Workspace root directory path to bind this session to (<workspaceDir>/.agent).",
      },
      screensDir: {
        type: "string",
        description: "Screens directory path to set for this session.",
      },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, ctx) {
    const action = args["action"] === "set" || args["action"] === "get" ? args["action"] : undefined;
    const cacheDir = str(args, "cacheDir");
    const workspaceDir = str(args, "workspaceDir");
    const screensDir = str(args, "screensDir");
    return configTool({ action, cacheDir, workspaceDir, screensDir }, ctx);
  },
};

/**
 * Legacy `pwa_*` tool names transparently routed to their canonical `browser_*` / `screen_learn` implementations (spec 028).
 */
export const LEGACY_TOOL_ALIASES: Readonly<Record<string, string>> = {
  pwa_config: "browser_config",
  pwa_open: "browser_open",
  pwa_install_runtime: "browser_install_runtime",
  pwa_auth: "browser_auth",
  pwa_snapshot: "browser_snapshot",
  pwa_click: "browser_click",
  pwa_fill: "browser_fill",
  pwa_upload: "browser_upload",
  pwa_download: "browser_download",
  pwa_screenshot: "browser_screenshot",
  pwa_extract: "browser_extract",
  pwa_find: "browser_find",
  pwa_act: "browser_act",
  pwa_learn: "screen_learn",
  pwa_wait: "browser_wait",
  pwa_discover: "browser_discover",
};

/**
 * Resolves any legacy `pwa_*` tool name to its canonical `browser_*` or `screen_learn` name.
 */
export function resolveToolName(name: string): string {
  return LEGACY_TOOL_ALIASES[name] ?? name;
}

export const TOOLS: readonly ToolDef[] = [
  configToolDef,
  open,
  installRuntime,
  authToolDef,
  snapshot,
  click,
  fill,
  upload,
  download,
  screenshotToolDef,
  extract,
  findToolDef,
  act,
  learnToolDef,
  waitToolDef,
  discoverToolDef,
];
