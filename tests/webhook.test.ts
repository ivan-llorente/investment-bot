import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProcessSignal } from '../src/application/process-signal.js';
import type { AlertLog, ExchangeGateway, Logger, PositionRepository } from '../src/domain/ports.js';
import { Position } from '../src/domain/position.js';
import { createApp } from '../src/interface/http/app.js';

const SECRET = 'test-secret-0123456789abcdef';
const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

function buildServer() {
  const positions: PositionRepository & { store: Map<string, Position> } = {
    store: new Map(),
    find(s) {
      return this.store.get(s);
    },
    save(p) {
      this.store.set(p.symbol, p);
    },
    remove(s) {
      this.store.delete(s);
    },
  };
  const alerts: AlertLog = { recordIfNew: () => true };
  const exchange: ExchangeGateway = {
    open: async () => ({ orderId: 'o-1' }),
    close: async () => ({ orderId: 'o-2' }),
  };
  const processSignal = new ProcessSignal(positions, alerts, exchange, silentLogger);
  return createApp({ processSignal, webhookSecret: SECRET, logger: silentLogger });
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = buildServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

function post(body: string) {
  return fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
}

const validEntry = JSON.stringify({
  secret: SECRET,
  strategy: 'donchian',
  ticker: 'BTCUSDT',
  action: 'entry',
  side: 'long',
  time: '2026-01-01T00:00:00Z',
  qty: '0.5',
  stop: '90000',
});

describe('POST /webhook', () => {
  it('JSON inválido -> 400', async () => {
    const res = await post('not json at all');
    expect(res.status).toBe(400);
  });

  it('payload con forma inválida -> 400', async () => {
    const res = await post(JSON.stringify({ secret: SECRET, action: 'fly' }));
    expect(res.status).toBe(400);
  });

  it('secret incorrecto -> 401', async () => {
    const res = await post(validEntry.replace(SECRET, 'wrong-secret-aaaaaaaaaaaa'));
    expect(res.status).toBe(401);
  });

  it('entry sin qty -> 422 (señal inválida)', async () => {
    const payload = JSON.parse(validEntry);
    delete payload.qty;
    const res = await post(JSON.stringify(payload));
    expect(res.status).toBe(422);
  });

  it('entry válida -> 200 con outcome', async () => {
    const res = await post(validEntry);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'opened', orderId: 'o-1' });
  });

  it('health responde ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
