// Read-only access to a Firefox profile SQLite database (spec 007 D1, reused by spec 011).
// SQLite never opens the live file: the db and its -wal are copied to a temp dir first, so
// Firefox's exclusive lock is never contended and the profile cannot be modified.
// `node:sqlite` is imported lazily and only here, so other commands never load it.
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export type SqlValue = string | number | bigint | null | Uint8Array;
export type Row = Record<string, SqlValue>;

export interface ProfileDb {
  all(sql: string, ...params: SqlValue[]): Row[];
}

// Returns null when the database file does not exist.
export async function withProfileDb<T>(dbPath: string, fn: (db: ProfileDb) => T): Promise<T | null> {
  if (!existsSync(dbPath)) return null;
  const dir = await mkdtemp(join(tmpdir(), "pwa-nav-db-"));
  try {
    const copy = join(dir, basename(dbPath));
    await copyFile(dbPath, copy);
    if (existsSync(`${dbPath}-wal`)) {
      await copyFile(`${dbPath}-wal`, `${copy}-wal`);
    }
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(copy);
    try {
      return fn({ all: (sql, ...params) => db.prepare(sql).all(...params) });
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
