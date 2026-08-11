import "server-only";

import Database from "better-sqlite3";
import path from "node:path";

const databasePath =
  process.env.STEINSTOSSEN_DB_PATH ??
  path.join(process.cwd(), "data", "steinstossen.sqlite");

const globalForDatabase = globalThis as unknown as {
  steinstossenDatabase?: Database.Database;
};

export const db =
  globalForDatabase.steinstossenDatabase ??
  new Database(databasePath, { fileMustExist: true, readonly: true });

db.pragma("foreign_keys = ON");
db.pragma("query_only = ON");

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.steinstossenDatabase = db;
}

export function queryAll<T>(sql: string, ...parameters: unknown[]): T[] {
  return db.prepare(sql).all(...parameters) as T[];
}

export function queryOne<T>(sql: string, ...parameters: unknown[]): T | undefined {
  return db.prepare(sql).get(...parameters) as T | undefined;
}
