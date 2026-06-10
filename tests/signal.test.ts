import { describe, expect, it } from 'vitest';
import { InvalidSignalError, TradeSignal } from '../src/domain/signal.js';
import { normalizeTicker } from '../src/domain/symbol.js';

describe('normalizeTicker', () => {
  it('convierte el formato de TradingView al de ccxt', () => {
    expect(normalizeTicker('BTCUSDT')).toBe('BTC/USDT');
    expect(normalizeTicker('ETHUSDC')).toBe('ETH/USDC');
    expect(normalizeTicker('SOLBTC')).toBe('SOL/BTC');
  });

  it('respeta símbolos ya normalizados', () => {
    expect(normalizeTicker('BTC/USDT')).toBe('BTC/USDT');
  });

  it('no rompe con quotes que son prefijo de otras', () => {
    // USDT debe ganar a USD aunque USD matchee primero alfabéticamente.
    expect(normalizeTicker('XRPUSDT')).toBe('XRP/USDT');
    expect(normalizeTicker('XRPUSD')).toBe('XRP/USD');
  });

  it('devuelve el ticker intacto si no reconoce la quote', () => {
    expect(normalizeTicker('WEIRDPAIR')).toBe('WEIRDPAIR');
  });
});

describe('TradeSignal', () => {
  const base = { strategy: 'donchian', ticker: 'BTCUSDT', side: 'long' as const, at: '2026-01-01T00:00:00Z' };

  it('entry válida construye y normaliza el símbolo', () => {
    const s = TradeSignal.entry({ ...base, qty: 0.5, stopPrice: 90000 });
    expect(s.symbol).toBe('BTC/USDT');
    expect(s.action).toBe('entry');
  });

  it('entry sin qty o con qty <= 0 se rechaza', () => {
    expect(() => TradeSignal.entry({ ...base, stopPrice: 1 })).toThrow(InvalidSignalError);
    expect(() => TradeSignal.entry({ ...base, qty: 0, stopPrice: 1 })).toThrow(InvalidSignalError);
    expect(() => TradeSignal.entry({ ...base, qty: -1, stopPrice: 1 })).toThrow(InvalidSignalError);
  });

  it('entry sin stop válido se rechaza', () => {
    expect(() => TradeSignal.entry({ ...base, qty: 1 })).toThrow(InvalidSignalError);
    expect(() => TradeSignal.entry({ ...base, qty: 1, stopPrice: 0 })).toThrow(InvalidSignalError);
  });

  it('exit no requiere qty ni stop', () => {
    const s = TradeSignal.exit(base);
    expect(s.action).toBe('exit');
    expect(s.qty).toBe(0);
  });

  it('dedupeKey es estable e identifica el evento', () => {
    const a = TradeSignal.entry({ ...base, qty: 1, stopPrice: 1 });
    const b = TradeSignal.entry({ ...base, qty: 1, stopPrice: 1 });
    const c = TradeSignal.entry({ ...base, at: '2026-01-02T00:00:00Z', qty: 1, stopPrice: 1 });
    expect(a.dedupeKey()).toBe(b.dedupeKey());
    expect(a.dedupeKey()).not.toBe(c.dedupeKey());
  });
});
