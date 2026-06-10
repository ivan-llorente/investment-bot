/**
 * Puertos del dominio (hexagonal): la aplicación depende de estas
 * interfaces, nunca de adaptadores concretos. Las implementaciones viven
 * en infrastructure/.
 */
import type { Position } from './position.js';
import type { TradeSignal } from './signal.js';

export interface PositionRepository {
  find(symbol: string): Position | undefined;
  save(position: Position): void;
  remove(symbol: string): void;
}

/** Registro de alertas procesadas para idempotencia (TV reintenta webhooks). */
export interface AlertLog {
  /** true si la alerta es nueva y quedó registrada; false si es duplicado. */
  recordIfNew(key: string): boolean;
}

export interface OrderResult {
  orderId: string;
  stopOrderId?: string;
}

export interface ExchangeGateway {
  open(signal: TradeSignal): Promise<OrderResult>;
  close(position: Position): Promise<OrderResult>;
}

/** Logging mínimo que necesita la capa de aplicación, sin acoplarse a pino. */
export interface Logger {
  info(context: object, message: string): void;
  warn(context: object, message: string): void;
  error(context: object, message: string): void;
}
