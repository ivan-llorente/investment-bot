import { describe, expect, it } from 'vitest';
import { ProcessSignal } from '../src/application/process-signal.js';
import type { AlertLog, ExchangeGateway, Logger, OrderResult, PositionRepository } from '../src/domain/ports.js';
import { Position } from '../src/domain/position.js';
import { TradeSignal } from '../src/domain/signal.js';

class FakePositions implements PositionRepository {
  store = new Map<string, Position>();
  find(symbol: string) {
    return this.store.get(symbol);
  }
  save(p: Position) {
    this.store.set(p.symbol, p);
  }
  remove(symbol: string) {
    this.store.delete(symbol);
  }
}

class FakeAlertLog implements AlertLog {
  seen = new Set<string>();
  recordIfNew(key: string) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

class FakeExchange implements ExchangeGateway {
  opened: TradeSignal[] = [];
  closed: Position[] = [];
  failNext = false;
  async open(signal: TradeSignal): Promise<OrderResult> {
    if (this.failNext) throw new Error('exchange down');
    this.opened.push(signal);
    return { orderId: 'o-1', stopOrderId: 's-1' };
  }
  async close(position: Position): Promise<OrderResult> {
    if (this.failNext) throw new Error('exchange down');
    this.closed.push(position);
    return { orderId: 'o-2' };
  }
}

const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

function makeSut() {
  const positions = new FakePositions();
  const alerts = new FakeAlertLog();
  const exchange = new FakeExchange();
  const sut = new ProcessSignal(positions, alerts, exchange, silentLogger);
  return { sut, positions, alerts, exchange };
}

const entrySignal = (at = 't1') =>
  TradeSignal.entry({ strategy: 'donchian', ticker: 'BTCUSDT', side: 'long', at, qty: 0.5, stopPrice: 90000 });
const exitSignal = (at = 't2') =>
  TradeSignal.exit({ strategy: 'donchian', ticker: 'BTCUSDT', side: 'long', at });

describe('ProcessSignal', () => {
  it('entry abre posición y la persiste', async () => {
    const { sut, positions, exchange } = makeSut();
    const outcome = await sut.execute(entrySignal());
    expect(outcome).toEqual({ status: 'opened', orderId: 'o-1' });
    expect(exchange.opened).toHaveLength(1);
    expect(positions.find('BTC/USDT')?.qty).toBe(0.5);
  });

  it('alerta duplicada no genera segunda orden', async () => {
    const { sut, exchange } = makeSut();
    await sut.execute(entrySignal('t1'));
    const second = await sut.execute(entrySignal('t1'));
    expect(second.status).toBe('duplicate');
    expect(exchange.opened).toHaveLength(1);
  });

  it('entry con posición ya abierta se ignora', async () => {
    const { sut, exchange } = makeSut();
    await sut.execute(entrySignal('t1'));
    const second = await sut.execute(entrySignal('t2'));
    expect(second).toEqual({ status: 'skipped', reason: 'position-already-open' });
    expect(exchange.opened).toHaveLength(1);
  });

  it('exit sin posición se ignora', async () => {
    const { sut, exchange } = makeSut();
    const outcome = await sut.execute(exitSignal());
    expect(outcome).toEqual({ status: 'skipped', reason: 'no-open-position' });
    expect(exchange.closed).toHaveLength(0);
  });

  it('exit con posición la cierra y borra el estado', async () => {
    const { sut, positions, exchange } = makeSut();
    await sut.execute(entrySignal());
    const outcome = await sut.execute(exitSignal());
    expect(outcome).toEqual({ status: 'closed', orderId: 'o-2' });
    expect(exchange.closed).toHaveLength(1);
    expect(positions.find('BTC/USDT')).toBeUndefined();
  });

  it('fallo del exchange en entry no persiste posición', async () => {
    const { sut, positions, exchange } = makeSut();
    exchange.failNext = true;
    const outcome = await sut.execute(entrySignal());
    expect(outcome.status).toBe('failed');
    expect(positions.find('BTC/USDT')).toBeUndefined();
  });

  it('fallo del exchange en exit conserva la posición', async () => {
    const { sut, positions, exchange } = makeSut();
    await sut.execute(entrySignal());
    exchange.failNext = true;
    const outcome = await sut.execute(exitSignal());
    expect(outcome.status).toBe('failed');
    expect(positions.find('BTC/USDT')).toBeDefined();
  });
});
