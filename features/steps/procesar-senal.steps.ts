import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { Position } from '../../src/domain/position.js';
import { TradeSignal, type Side } from '../../src/domain/signal.js';
import type { TradingWorld } from '../support/world.js';

Given('un sistema sin posiciones abiertas', function (this: TradingWorld) {
  assert.equal(this.positions.store.size, 0);
});

Given(
  'una posición {word} abierta en {string} con qty {float} de la estrategia {string}',
  function (this: TradingWorld, side: Side, symbol: string, qty: number, strategy: string) {
    this.positions.save(new Position(symbol, side, qty, strategy, new Date().toISOString()));
  },
);

Given('que el exchange fallará en la siguiente orden', function (this: TradingWorld) {
  this.exchange.failNext = true;
});

When(
  'llega una señal de entrada {word} de {string} sobre {string} con qty {float} y stop {int}',
  async function (this: TradingWorld, side: Side, strategy: string, ticker: string, qty: number, stop: number) {
    this.lastSignal = TradeSignal.entry({
      strategy,
      ticker,
      side,
      at: '2026-06-10T12:00:00Z',
      qty,
      stopPrice: stop,
    });
    this.outcome = await this.sut.execute(this.lastSignal);
  },
);

When('llega de nuevo la misma alerta', async function (this: TradingWorld) {
  assert.ok(this.lastSignal, 'no hay señal previa que reenviar');
  this.outcome = await this.sut.execute(this.lastSignal);
});

When(
  'llega una señal de salida {word} de {string} sobre {string}',
  async function (this: TradingWorld, side: Side, strategy: string, ticker: string) {
    this.lastSignal = TradeSignal.exit({ strategy, ticker, side, at: '2026-06-10T16:00:00Z' });
    this.outcome = await this.sut.execute(this.lastSignal);
  },
);

Then('el resultado es {string}', function (this: TradingWorld, status: string) {
  assert.equal(this.outcome?.status, status);
});

Then('el resultado es {string} por {string}', function (this: TradingWorld, status: string, reason: string) {
  assert.equal(this.outcome?.status, status);
  assert.ok(this.outcome && 'reason' in this.outcome, 'el outcome no incluye reason');
  assert.equal(this.outcome.reason, reason);
});

Then(
  'existe una posición abierta en {string} con qty {float}',
  function (this: TradingWorld, symbol: string, qty: number) {
    const position = this.positions.find(symbol);
    assert.ok(position, `no hay posición en ${symbol}`);
    assert.equal(position.qty, qty);
  },
);

Then('no queda ninguna posición abierta en {string}', function (this: TradingWorld, symbol: string) {
  assert.equal(this.positions.find(symbol), undefined);
});

Then('el exchange recibió {int} orden/órdenes de apertura', function (this: TradingWorld, count: number) {
  assert.equal(this.exchange.opened.length, count);
});

Then('el exchange recibió {int} orden/órdenes de cierre', function (this: TradingWorld, count: number) {
  assert.equal(this.exchange.closed.length, count);
});

Then('el exchange no recibió ninguna orden de cierre', function (this: TradingWorld) {
  assert.equal(this.exchange.closed.length, 0);
});
