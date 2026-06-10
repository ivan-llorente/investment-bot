import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { ACCEPTANCE_SECRET, type TradingWorld } from '../support/world.js';

function entryPayload(ticker: string): Record<string, string> {
  return {
    secret: ACCEPTANCE_SECRET,
    strategy: 'donchian-v2',
    ticker,
    action: 'entry',
    side: 'long',
    time: '2026-06-10T12:00:00Z',
    qty: '0.5',
    stop: '90000',
  };
}

async function send(world: TradingWorld, body: string): Promise<void> {
  const stack = world.acceptance;
  assert.ok(stack, 'el servidor no está en marcha (falta el paso Dado)');
  const res = await fetch(`${stack.baseUrl}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
  stack.lastStatus = res.status;
  stack.lastBody = await res.json().catch(() => undefined);
}

Given('el servidor del bot en marcha', async function (this: TradingWorld) {
  await this.startServer();
});

When('envío por HTTP una alerta de entrada válida sobre {string}', async function (this: TradingWorld, ticker: string) {
  const payload = entryPayload(ticker);
  this.acceptance!.lastPayload = payload;
  await send(this, JSON.stringify(payload));
});

When('reenvío por HTTP la misma alerta', async function (this: TradingWorld) {
  const payload = this.acceptance?.lastPayload;
  assert.ok(payload, 'no hay alerta previa que reenviar');
  await send(this, JSON.stringify(payload));
});

When('envío por HTTP la alerta de salida correspondiente', async function (this: TradingWorld) {
  const payload = this.acceptance?.lastPayload;
  assert.ok(payload, 'no hay alerta previa de la que derivar la salida');
  await send(this, JSON.stringify({ ...payload, action: 'exit', time: '2026-06-10T16:00:00Z', qty: '0', stop: '0' }));
});

When('envío por HTTP un cuerpo que no es JSON', async function (this: TradingWorld) {
  await send(this, 'esto no es json');
});

When('envío por HTTP una alerta de entrada con secret incorrecto', async function (this: TradingWorld) {
  await send(this, JSON.stringify({ ...entryPayload('BTCUSDT'), secret: 'wrong-secret-aaaaaaaaaaaaaa' }));
});

When('envío por HTTP una alerta sin los campos obligatorios', async function (this: TradingWorld) {
  await send(this, JSON.stringify({ secret: ACCEPTANCE_SECRET, action: 'entry' }));
});

When('envío por HTTP una alerta de entrada sin stop', async function (this: TradingWorld) {
  const { stop: _stop, ...payload } = entryPayload('BTCUSDT');
  await send(this, JSON.stringify(payload));
});

When('envío por HTTP una alerta de salida sobre {string}', async function (this: TradingWorld, ticker: string) {
  await send(this, JSON.stringify({ ...entryPayload(ticker), action: 'exit', qty: '0', stop: '0' }));
});

When('consulto el healthcheck por HTTP', async function (this: TradingWorld) {
  const stack = this.acceptance;
  assert.ok(stack, 'el servidor no está en marcha');
  const res = await fetch(`${stack.baseUrl}/health`);
  stack.lastStatus = res.status;
});

Then('la respuesta HTTP es {int}', function (this: TradingWorld, status: number) {
  assert.equal(this.acceptance?.lastStatus, status);
});

Then('la respuesta HTTP es {int} con estado {string}', function (this: TradingWorld, status: number, outcome: string) {
  assert.equal(this.acceptance?.lastStatus, status);
  const body = this.acceptance?.lastBody as { status?: string } | undefined;
  assert.equal(body?.status, outcome);
});

Then('la base de datos contiene una posición en {string}', function (this: TradingWorld, symbol: string) {
  assert.ok(this.acceptance?.positions.find(symbol), `no hay posición persistida en ${symbol}`);
});

Then('la base de datos no contiene ninguna posición en {string}', function (this: TradingWorld, symbol: string) {
  assert.equal(this.acceptance?.positions.find(symbol), undefined);
});

Then('el gateway recibió exactamente {int} orden/órdenes de apertura', function (this: TradingWorld, count: number) {
  assert.equal(this.acceptance?.exchange.opened.length, count);
});

Then('el gateway no recibió ninguna orden', function (this: TradingWorld) {
  assert.equal(this.acceptance?.exchange.opened.length, 0);
  assert.equal(this.acceptance?.exchange.closed.length, 0);
});
