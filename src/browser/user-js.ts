export const MANAGED_BLOCK_START = "// BEGIN pwa-nav managed (do not edit)";
export const MANAGED_BLOCK_END = "// END pwa-nav managed";

export type PrefValue = boolean | number | string;

export function serializeUserJs(prefs: Readonly<Record<string, PrefValue>>): string {
  const lines = Object.entries(prefs).map(([key, val]) => {
    return `user_pref(${JSON.stringify(key)}, ${JSON.stringify(val)});`;
  });
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

/**
 * Extracts preference keys defined via user_pref("key", ...) in user lines outside managed blocks.
 */
export function extractPrefKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const regex = /^\s*user_pref\s*\(\s*["']([^"']+)["']\s*,/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/**
 * Merges managed preferences into existing user.js content preserving custom user lines.
 * 
 * Rules (D2@1):
 * - Managed block is delimited by MANAGED_BLOCK_START / MANAGED_BLOCK_END.
 * - Everything outside the managed block is kept byte-for-byte.
 * - If a pref is set by the user outside the block, it is omitted from the managed block
 *   unless explicitly exempted by unoverridableKeys.
 * - Legacy files without delimiters (written by older pwa-nav) are treated as fully managed.
 */
export function mergeUserJs(
  existingContent: string,
  managedPrefs: Readonly<Record<string, PrefValue>>,
  options: {
    unoverridableKeys?: ReadonlySet<string>;
  } = {},
): string {
  const trimmed = existingContent.trim();
  const hasManagedBlock =
    existingContent.includes(MANAGED_BLOCK_START) && existingContent.includes(MANAGED_BLOCK_END);

  let userContentBefore = "";
  let userContentAfter = "";

  if (hasManagedBlock) {
    const startIndex = existingContent.indexOf(MANAGED_BLOCK_START);
    let endIndex = existingContent.indexOf(MANAGED_BLOCK_END) + MANAGED_BLOCK_END.length;
    if (existingContent[endIndex] === "\r" && existingContent[endIndex + 1] === "\n") {
      endIndex += 2;
    } else if (existingContent[endIndex] === "\n") {
      endIndex += 1;
    }

    userContentBefore = existingContent.slice(0, startIndex);
    userContentAfter = existingContent.slice(endIndex);
  } else if (trimmed.length > 0) {
    // Check if the legacy file looks like it was generated entirely by older pwa-nav or has custom user lines.
    // If it has no markers, legacy files from older pwa-nav are treated as fully managed per D2.
    // However, if it contains user lines, we want to know if it's considered legacy managed or custom.
    // Per D2: "Legacy files without markers (written by older pwa-nav) are treated as fully managed."
    userContentBefore = "";
    userContentAfter = "";
  }

  // Find all keys defined in user parts
  const userKeys = new Set<string>([
    ...extractPrefKeys(userContentBefore),
    ...extractPrefKeys(userContentAfter),
  ]);

  const unoverridable = options.unoverridableKeys ?? new Set<string>();

  // Filter managed prefs: if user explicitly sets it outside, omit from managed block unless unoverridable
  const filteredManaged: Record<string, PrefValue> = {};
  for (const [key, val] of Object.entries(managedPrefs)) {
    if (unoverridable.has(key) || !userKeys.has(key)) {
      filteredManaged[key] = val;
    }
  }

  const serializedBlock = serializeUserJs(filteredManaged);
  const managedBlock = `${MANAGED_BLOCK_START}\n${serializedBlock}${MANAGED_BLOCK_END}\n`;

  if (!hasManagedBlock && trimmed.length === 0) {
    return managedBlock;
  }

  if (hasManagedBlock) {
    return `${userContentBefore}${managedBlock}${userContentAfter}`;
  }

  // Legacy file without markers: replaced by the managed block entirely
  return managedBlock;
}
