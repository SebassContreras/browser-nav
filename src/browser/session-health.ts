// Session health verdict from stored cookies (spec 007 D2). Pure: no IO, no clock.
import type { StoredCookie } from "./session-reader.js";
import { siteOf } from "./site.js";

export type SessionVerdict = "authenticated" | "expired" | "unauthenticated" | "no_profile";

export interface SessionCookieInfo {
  name: string;
  host: string;
  expiresAt: string;
}

export interface SessionHealth {
  verdict: SessionVerdict;
  source: "disk";
  ttlSeconds?: number;
  cookies: SessionCookieInfo[];
  hint?: string;
}

export interface SessionHealthOptions {
  host: string;
  nowMs: number;
  // Explicit auth cookie names; when absent the name heuristic is used.
  authCookieNames?: readonly string[];
  // Command suggested when the user has to sign in again.
  signInHint?: string;
}

const AUTH_COOKIE_NAME = /sess|sid|auth|token|login|jwt|_at$|^SAPISID$|^__(Secure|Host)-/i;

// Cookies set by login gateways / preferences prior to credential authentication (e.g. Google pre-login)
const PRE_AUTH_COOKIE_NAME = /^(__Host-GAPS|__Secure-ENID)$/i;

// Firefox stored `expiry` in seconds and later in milliseconds; anything above 1e11
// (year 5138 in seconds) can only be milliseconds.
export function expiryToMs(expiry: number): number {
  return expiry > 1e11 ? expiry : expiry * 1000;
}

export function evaluateSessionHealth(
  cookies: readonly StoredCookie[] | null,
  options: SessionHealthOptions,
): SessionHealth {
  const signIn = options.signInHint ?? "browser-nav auth <app>";
  if (cookies === null) {
    return {
      verdict: "no_profile",
      source: "disk",
      cookies: [],
      hint: `no profile or cookie store yet; sign in first: ${signIn}`,
    };
  }

  const explicit = options.authCookieNames;
  const isAuth = (name: string): boolean =>
    explicit !== undefined && explicit.length > 0
      ? explicit.includes(name)
      : AUTH_COOKIE_NAME.test(name) && !PRE_AUTH_COOKIE_NAME.test(name);
  // Same site (eTLD+1) as the app: a session cookie on `.www.example.com` counts for `example.com`.
  const site = siteOf(options.host);
  const auth = cookies.filter((c) => siteOf(c.host) === site && isAuth(c.name));
  const info = auth.map((c) => ({
    name: c.name,
    host: c.host,
    expiresAt: new Date(expiryToMs(c.expiry)).toISOString(),
  }));

  if (auth.length === 0) {
    return {
      verdict: "unauthenticated",
      source: "disk",
      cookies: [],
      hint: `no auth cookies stored for ${options.host}. Sign in: ${signIn}. A running window may still hold session-only cookies; confirm with browser-nav snapshot.`,
    };
  }

  const latestMs = Math.max(...auth.map((c) => expiryToMs(c.expiry)));
  if (latestMs <= options.nowMs) {
    return {
      verdict: "expired",
      source: "disk",
      ttlSeconds: 0,
      cookies: info,
      hint: `auth cookies for ${options.host} have expired. Sign in again: ${signIn}`,
    };
  }
  return {
    verdict: "authenticated",
    source: "disk",
    ttlSeconds: Math.floor((latestMs - options.nowMs) / 1000),
    cookies: info,
  };
}
