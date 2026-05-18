"""Tools de lectura de la DB de trades de Freqtrade."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

from strands import tool

from ._paths import DB_PATH


def _connect() -> sqlite3.Connection | None:
    if not DB_PATH.exists():
        return None
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@tool
def recent_trades(limit: int = 20) -> list[dict[str, Any]]:
    """Devuelve los últimos N trades cerrados.

    Args:
        limit: Cantidad máxima de trades a devolver.
    """
    conn = _connect()
    if conn is None:
        return [{"error": f"DB no encontrada en {DB_PATH}"}]
    rows = conn.execute(
        """
        SELECT id, pair, open_date, close_date, open_rate, close_rate,
               amount, stake_amount, close_profit, close_profit_abs,
               exit_reason, strategy, enter_tag
          FROM trades
         WHERE close_date IS NOT NULL
      ORDER BY close_date DESC
         LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@tool
def open_trades() -> list[dict[str, Any]]:
    """Devuelve los trades actualmente abiertos."""
    conn = _connect()
    if conn is None:
        return [{"error": f"DB no encontrada en {DB_PATH}"}]
    rows = conn.execute(
        """
        SELECT id, pair, open_date, open_rate, amount, stake_amount,
               stop_loss, strategy, enter_tag
          FROM trades
         WHERE close_date IS NULL
      ORDER BY open_date DESC
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@tool
def performance_summary(days: int = 30) -> dict[str, Any]:
    """Resumen agregado de performance de los últimos N días.

    Args:
        days: Ventana en días desde ahora hacia atrás.

    Returns:
        Número de trades, winrate, P&L absoluto, mejor y peor trade.
    """
    conn = _connect()
    if conn is None:
        return {"error": f"DB no encontrada en {DB_PATH}"}
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    row = conn.execute(
        """
        SELECT COUNT(*)                                     AS n,
               SUM(CASE WHEN close_profit > 0 THEN 1 ELSE 0 END) AS wins,
               SUM(close_profit_abs)                        AS pnl_abs,
               AVG(close_profit)                            AS avg_pct,
               MIN(close_profit)                            AS worst,
               MAX(close_profit)                            AS best
          FROM trades
         WHERE close_date >= ?
        """,
        (since,),
    ).fetchone()
    conn.close()

    n = row["n"] or 0
    wins = row["wins"] or 0
    return {
        "window_days": days,
        "trades": n,
        "wins": wins,
        "winrate": (wins / n) if n else None,
        "pnl_abs": row["pnl_abs"] or 0.0,
        "avg_pct": row["avg_pct"],
        "worst_pct": row["worst"],
        "best_pct": row["best"],
    }
