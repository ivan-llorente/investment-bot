/**
 * Caso de uso central: procesar una señal de trading ya validada.
 *
 * Reglas de negocio que orquesta:
 *   1. Idempotencia: la misma alerta (retry de TradingView) no genera
 *      dos órdenes.
 *   2. Una posición por símbolo: entry sobre símbolo con posición abierta
 *      se ignora; exit sin posición se ignora.
 *   3. El exchange solo se toca después de pasar 1 y 2.
 *
 * La persistencia de la posición ocurre tras confirmar la orden: si el
 * exchange falla, el estado local no cambia y la alerta queda consumida
 * (TV ya hizo su retry; reintentos de órdenes fallidas son decisión
 * humana, no automática).
 */
import { Position } from '../domain/position.js';
import type { TradeSignal } from '../domain/signal.js';
import type { AlertLog, ExchangeGateway, Logger, PositionRepository } from '../domain/ports.js';

export type ProcessOutcome =
  | { status: 'opened'; orderId: string }
  | { status: 'closed'; orderId: string }
  | { status: 'duplicate' }
  | { status: 'skipped'; reason: 'position-already-open' | 'no-open-position' }
  | { status: 'failed'; reason: string };

export class ProcessSignal {
  constructor(
    private readonly positions: PositionRepository,
    private readonly alertLog: AlertLog,
    private readonly exchange: ExchangeGateway,
    private readonly logger: Logger,
  ) {}

  async execute(signal: TradeSignal): Promise<ProcessOutcome> {
    const ctx = {
      strategy: signal.strategy,
      symbol: signal.symbol,
      action: signal.action,
      side: signal.side,
    };

    if (!this.alertLog.recordIfNew(signal.dedupeKey())) {
      this.logger.warn(ctx, 'alerta duplicada ignorada (retry de TV o reenvío)');
      return { status: 'duplicate' };
    }

    return signal.action === 'entry' ? this.openPosition(signal, ctx) : this.closePosition(signal, ctx);
  }

  private async openPosition(signal: TradeSignal, ctx: object): Promise<ProcessOutcome> {
    if (this.positions.find(signal.symbol)) {
      this.logger.warn(ctx, 'entry ignorada: ya hay posición abierta en el símbolo');
      return { status: 'skipped', reason: 'position-already-open' };
    }

    try {
      const result = await this.exchange.open(signal);
      this.positions.save(
        new Position(signal.symbol, signal.side, signal.qty, signal.strategy, new Date().toISOString()),
      );
      this.logger.info({ ...ctx, orderId: result.orderId }, 'posición abierta');
      return { status: 'opened', orderId: result.orderId };
    } catch (err) {
      this.logger.error({ ...ctx, err }, 'fallo abriendo posición');
      return { status: 'failed', reason: err instanceof Error ? err.message : String(err) };
    }
  }

  private async closePosition(signal: TradeSignal, ctx: object): Promise<ProcessOutcome> {
    const position = this.positions.find(signal.symbol);
    if (!position) {
      this.logger.warn(ctx, 'exit ignorada: no hay posición abierta en el símbolo');
      return { status: 'skipped', reason: 'no-open-position' };
    }

    try {
      const result = await this.exchange.close(position);
      this.positions.remove(position.symbol);
      this.logger.info({ ...ctx, orderId: result.orderId }, 'posición cerrada');
      return { status: 'closed', orderId: result.orderId };
    } catch (err) {
      this.logger.error({ ...ctx, err }, 'fallo cerrando posición');
      return { status: 'failed', reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
