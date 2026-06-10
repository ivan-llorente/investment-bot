/**
 * TradeSignal: value object inmutable que representa una señal de la
 * estrategia ya validada. Es la única forma en que una alerta externa
 * entra al dominio: si los invariantes no se cumplen, el constructor
 * estático lanza y la alerta se rechaza en la frontera.
 */
import { createHash } from 'node:crypto';
import { normalizeTicker } from './symbol.js';

export type Side = 'long' | 'short';
export type SignalAction = 'entry' | 'exit';

export class InvalidSignalError extends Error {}

interface SignalProps {
  strategy: string;
  ticker: string;
  side: Side;
  at: string;
  qty?: number;
  stopPrice?: number;
}

export class TradeSignal {
  private constructor(
    readonly strategy: string,
    readonly symbol: string,
    readonly action: SignalAction,
    readonly side: Side,
    readonly at: string,
    readonly qty: number,
    readonly stopPrice: number,
  ) {}

  static entry(props: SignalProps): TradeSignal {
    const { qty, stopPrice } = props;
    if (qty === undefined || !Number.isFinite(qty) || qty <= 0) {
      throw new InvalidSignalError(`entry requiere qty > 0, recibido: ${qty}`);
    }
    if (stopPrice === undefined || !Number.isFinite(stopPrice) || stopPrice <= 0) {
      throw new InvalidSignalError(`entry requiere stop > 0, recibido: ${stopPrice}`);
    }
    return TradeSignal.build('entry', props, qty, stopPrice);
  }

  static exit(props: SignalProps): TradeSignal {
    return TradeSignal.build('exit', props, 0, 0);
  }

  private static build(
    action: SignalAction,
    props: SignalProps,
    qty: number,
    stopPrice: number,
  ): TradeSignal {
    if (!props.strategy.trim()) throw new InvalidSignalError('strategy vacío');
    if (!props.ticker.trim()) throw new InvalidSignalError('ticker vacío');
    if (!props.at.trim()) throw new InvalidSignalError('timestamp vacío');
    return new TradeSignal(
      props.strategy.trim(),
      normalizeTicker(props.ticker),
      action,
      props.side,
      props.at.trim(),
      qty,
      stopPrice,
    );
  }

  /**
   * Clave de idempotencia: una estrategia no emite dos señales distintas
   * con la misma acción/lado/timestamp sobre el mismo símbolo, así que
   * dos alertas con la misma clave son el mismo evento (retry de TV).
   */
  dedupeKey(): string {
    const raw = [this.strategy, this.symbol, this.action, this.side, this.at].join('|');
    return createHash('sha256').update(raw).digest('hex');
  }
}
