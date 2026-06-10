/**
 * Position: entidad raíz del agregado (el único agregado del sistema).
 * Identidad = symbol: el sistema mantiene como máximo una posición por
 * símbolo, igual que las estrategias Pine (pyramiding = 0).
 */
import type { Side } from './signal.js';

export class InvalidPositionError extends Error {}

export class Position {
  constructor(
    readonly symbol: string,
    readonly side: Side,
    readonly qty: number,
    readonly strategy: string,
    readonly openedAt: string,
  ) {
    if (!symbol.trim()) throw new InvalidPositionError('symbol vacío');
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new InvalidPositionError(`qty debe ser > 0, recibido: ${qty}`);
    }
  }
}
