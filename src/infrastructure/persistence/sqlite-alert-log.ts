import type { AlertLog } from '../../domain/ports.js';
import type { Db } from './db.js';

const RETENTION_DAYS = 7;

export class SqliteAlertLog implements AlertLog {
  constructor(private readonly db: Db) {}

  recordIfNew(key: string): boolean {
    this.prune();
    const result = this.db
      .prepare('INSERT OR IGNORE INTO processed_alerts (key, seen_at) VALUES (?, ?)')
      .run(key, new Date().toISOString());
    return result.changes === 1;
  }

  private prune(): void {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
    this.db.prepare('DELETE FROM processed_alerts WHERE seen_at < ?').run(cutoff);
  }
}
