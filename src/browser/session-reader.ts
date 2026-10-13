// The only place that knows Firefox's `moz_cookies` schema (spec 007 D3).
// Cookie values are never selected: they are credentials and the health check does not need them.
import { join } from "node:path";
import { withProfileDb } from "./profile-db.js";

export interface StoredCookie {
  name: string;
  host: string;
  path: string;
  // Raw `moz_cookies.expiry`; its unit changed across Firefox versions (see session-health.ts).
  expiry: number;
}

// Returns null when the profile has no cookies.sqlite yet.
export async function readProfileCookies(profileDir: string): Promise<StoredCookie[] | null> {
  return withProfileDb(join(profileDir, "cookies.sqlite"), (db) =>
    db.all("SELECT name, host, path, expiry FROM moz_cookies").map((row) => ({
      name: String(row["name"]),
      host: String(row["host"]),
      path: String(row["path"]),
      expiry: Number(row["expiry"]),
    })),
  );
}
