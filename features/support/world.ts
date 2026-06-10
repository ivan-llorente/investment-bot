/**
 * World de Cucumber: cada escenario recibe una instancia fresca.
 *
 * Dos niveles de SUT:
 *  - Unit: el caso de uso (this.sut) cableado a fakes en memoria.
 *  - Acceptance: el stack HTTP real (this.acceptance) — Express + Zod +
 *    caso de uso + SQLite en memoria; el único doble es el gateway del
 *    exchange. Es el mismo grafo de objetos que monta main.ts.
 */
import type { Server } from 'node:http';
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { ProcessSignal, type ProcessOutcome } from '../../src/application/process-signal.js';
import type {
  AlertLog,
  ExchangeGateway,
  Logger,
  OrderResult,
  PositionRepository,
} from '../../src/domain/ports.js';
import type { Position } from '../../src/domain/position.js';
import type { TradeSignal } from '../../src/domain/signal.js';
import { openInMemoryDb } from '../../src/infrastructure/persistence/db.js';
import { SqliteAlertLog } from '../../src/infrastructure/persistence/sqlite-alert-log.js';
import { SqlitePositionRepository } from '../../src/infrastructure/persistence/sqlite-position-repo.js';
import { createApp } from '../../src/interface/http/app.js';

export class FakePositions implements PositionRepository {
  readonly store = new Map<string, Position>();
  find(symbol: string): Position | undefined {
    return this.store.get(symbol);
  }
  save(position: Position): void {
    this.store.set(position.symbol, position);
  }
  remove(symbol: string): void {
    this.store.delete(symbol);
  }
}

export class FakeAlertLog implements AlertLog {
  private readonly seen = new Set<string>();
  recordIfNew(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

export class FakeExchange implements ExchangeGateway {
  readonly opened: TradeSignal[] = [];
  readonly closed: Position[] = [];
  failNext = false;

  async open(signal: TradeSignal): Promise<OrderResult> {
    this.consumeFailure();
    this.opened.push(signal);
    return { orderId: `fake-open-${this.opened.length}` };
  }

  async close(position: Position): Promise<OrderResult> {
    this.consumeFailure();
    this.closed.push(position);
    return { orderId: `fake-close-${this.closed.length}` };
  }

  private consumeFailure(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('exchange down');
    }
  }
}

const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

export const ACCEPTANCE_SECRET = 'acceptance-secret-0123456789abcdef';

export interface AcceptanceStack {
  server: Server;
  baseUrl: string;
  exchange: FakeExchange;
  positions: SqlitePositionRepository;
  lastStatus?: number;
  lastBody?: unknown;
  lastPayload?: Record<string, string>;
}

export class TradingWorld extends World {
  readonly positions = new FakePositions();
  readonly alerts = new FakeAlertLog();
  readonly exchange = new FakeExchange();
  readonly sut = new ProcessSignal(this.positions, this.alerts, this.exchange, silentLogger);

  lastSignal?: TradeSignal;
  outcome?: ProcessOutcome;
  rejection?: Error;

  acceptance?: AcceptanceStack;

  async startServer(): Promise<AcceptanceStack> {
    const db = openInMemoryDb();
    const positions = new SqlitePositionRepository(db);
    const exchange = new FakeExchange();
    const processSignal = new ProcessSignal(positions, new SqliteAlertLog(db), exchange, silentLogger);
    const app = createApp({ processSignal, webhookSecret: ACCEPTANCE_SECRET, logger: silentLogger });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (typeof address === 'string' || address === null) throw new Error('no se pudo abrir puerto');

    this.acceptance = {
      server,
      baseUrl: `http://127.0.0.1:${address.port}`,
      exchange,
      positions,
    };
    return this.acceptance;
  }
}

setWorldConstructor(TradingWorld);
