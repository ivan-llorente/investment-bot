/**
 * Adaptador paper: simula la ejecución sin tocar ningún exchange.
 * Mismo contrato que el gateway live, ids sintéticos.
 */
import { randomUUID } from 'node:crypto';
import type { ExchangeGateway, Logger, OrderResult } from '../../domain/ports.js';
import type { Position } from '../../domain/position.js';
import type { TradeSignal } from '../../domain/signal.js';

export class PaperGateway implements ExchangeGateway {
  constructor(private readonly logger: Logger) {}

  async open(signal: TradeSignal): Promise<OrderResult> {
    const orderId = `paper-${randomUUID()}`;
    this.logger.info(
      { symbol: signal.symbol, side: signal.side, qty: signal.qty, stop: signal.stopPrice, orderId },
      '[PAPER] entry simulada',
    );
    return { orderId, stopOrderId: `paper-stop-${randomUUID()}` };
  }

  async close(position: Position): Promise<OrderResult> {
    const orderId = `paper-${randomUUID()}`;
    this.logger.info(
      { symbol: position.symbol, side: position.side, qty: position.qty, orderId },
      '[PAPER] exit simulada',
    );
    return { orderId };
  }
}
