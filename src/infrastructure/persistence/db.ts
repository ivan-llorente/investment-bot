import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

export function openDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'bot.sqlite'));
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

export function openInMemoryDb(): Db {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      symbol    TEXT PRIMARY KEY,
      side      TEXT NOT NULL,
      qty       REAL NOT NULL,
      strategy  TEXT NOT NULL,
      opened_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed_alerts (
      key     TEXT PRIMARY KEY,
      seen_at TEXT NOT NULL
    );
  `);
}
