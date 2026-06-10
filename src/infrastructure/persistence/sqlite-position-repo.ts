import { Position } from '../../domain/position.js';
import type { PositionRepository } from '../../domain/ports.js';
import type { Side } from '../../domain/signal.js';
import type { Db } from './db.js';

interface PositionRow {
  symbol: string;
  side: Side;
  qty: number;
  strategy: string;
  opened_at: string;
}

export class SqlitePositionRepository implements PositionRepository {
  constructor(private readonly db: Db) {}

  find(symbol: string): Position | undefined {
    const row = this.db
      .prepare('SELECT symbol, side, qty, strategy, opened_at FROM positions WHERE symbol = ?')
      .get(symbol) as PositionRow | undefined;
    if (!row) return undefined;
    return new Position(row.symbol, row.side, row.qty, row.strategy, row.opened_at);
  }

  save(position: Position): void {
    this.db
      .prepare(
        `INSERT INTO positions (symbol, side, qty, strategy, opened_at)
         VALUES (@symbol, @side, @qty, @strategy, @openedAt)
         ON CONFLICT(symbol) DO UPDATE SET
           side = @side, qty = @qty, strategy = @strategy, opened_at = @openedAt`,
      )
      .run({
        symbol: position.symbol,
        side: position.side,
        qty: position.qty,
        strategy: position.strategy,
        openedAt: position.openedAt,
      });
  }

  remove(symbol: string): void {
    this.db.prepare('DELETE FROM positions WHERE symbol = ?').run(symbol);
  }
}
