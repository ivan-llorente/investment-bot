import assert from 'node:assert/strict';
import { Then, When } from '@cucumber/cucumber';
import { InvalidSignalError, TradeSignal } from '../../src/domain/signal.js';
import type { TradingWorld } from '../support/world.js';

const base = { strategy: 'donchian', ticker: 'BTCUSDT', side: 'long' as const, at: '2026-06-10T12:00:00Z' };

function tryBuild(world: TradingWorld, build: () => TradeSignal): void {
  world.rejection = undefined;
  world.lastSignal = undefined;
  try {
    world.lastSignal = build();
  } catch (err) {
    world.rejection = err as Error;
  }
}

When('intento construir una señal de entrada sin stop', function (this: TradingWorld) {
  tryBuild(this, () => TradeSignal.entry({ ...base, qty: 1 }));
});

When('intento construir una señal de entrada con qty {float}', function (this: TradingWorld, qty: number) {
  tryBuild(this, () => TradeSignal.entry({ ...base, qty, stopPrice: 90000 }));
});

When('intento construir una señal de salida sin qty ni stop', function (this: TradingWorld) {
  tryBuild(this, () => TradeSignal.exit(base));
});

When('intento construir una señal de entrada sobre {string}', function (this: TradingWorld, ticker: string) {
  tryBuild(this, () => TradeSignal.entry({ ...base, ticker, qty: 1, stopPrice: 90000 }));
});

Then('la señal es rechazada', function (this: TradingWorld) {
  assert.ok(this.rejection, 'se esperaba un rechazo y la señal se construyó');
  assert.ok(this.rejection instanceof InvalidSignalError, `error inesperado: ${this.rejection}`);
});

Then('la señal se construye correctamente', function (this: TradingWorld) {
  assert.equal(this.rejection, undefined, `la señal fue rechazada: ${this.rejection}`);
  assert.ok(this.lastSignal);
});

Then('la señal apunta al símbolo {string}', function (this: TradingWorld, symbol: string) {
  assert.ok(this.lastSignal, 'no se construyó la señal');
  assert.equal(this.lastSignal.symbol, symbol);
});
