/**
 * Adaptador live sobre ccxt -> Crypto.com Exchange.
 * Entry = market order + stop reduce-only. Exit = market order inversa.
 */
import ccxt from 'ccxt';
import type { ExchangeGateway, OrderResult } from '../../domain/ports.js';
import type { Position } from '../../domain/position.js';
import type { TradeSignal } from '../../domain/signal.js';

export class CcxtGateway implements ExchangeGateway {
  private readonly exchange: InstanceType<typeof ccxt.cryptocom>;

  constructor(apiKey: string, apiSecret: string) {
    this.exchange = new ccxt.cryptocom({ apiKey, secret: apiSecret });
  }

  async open(signal: TradeSignal): Promise<OrderResult> {
    const side = signal.side === 'long' ? 'buy' : 'sell';
    const entry = await this.exchange.createMarketOrder(signal.symbol, side, signal.qty);

    const stopSide = signal.side === 'long' ? 'sell' : 'buy';
    const stop = await this.exchange.createOrder(
      signal.symbol,
      'stop',
      stopSide,
      signal.qty,
      undefined,
      { stopPrice: signal.stopPrice, triggerPrice: signal.stopPrice, reduceOnly: true },
    );

    return { orderId: String(entry.id), stopOrderId: String(stop.id) };
  }

  async close(position: Position): Promise<OrderResult> {
    const side = position.side === 'long' ? 'sell' : 'buy';
    const order = await this.exchange.createMarketOrder(position.symbol, side, position.qty);
    return { orderId: String(order.id) };
  }
}
