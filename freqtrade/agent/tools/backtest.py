"""Tools de inspección de estrategias y ejecución de backtests."""
from __future__ import annotations

import subprocess
from typing import Optional

from strands import tool

from ._paths import COMPOSE_DIR, STRATEGIES_DIR


@tool
def list_strategies() -> list[str]:
    """Lista las estrategias disponibles en user_data/strategies."""
    if not STRATEGIES_DIR.exists():
        return []
    return sorted(
        p.stem for p in STRATEGIES_DIR.glob("*.py") if not p.name.startswith("_")
    )


@tool
def run_backtest(
    strategy: str,
    timerange: str,
    pairs: Optional[list[str]] = None,
) -> dict:
    """Corre un backtest de Freqtrade vía docker compose.

    Args:
        strategy: Nombre de la clase de estrategia (ej. "DonchianBreakout").
        timerange: Rango "YYYYMMDD-YYYYMMDD" (ej. "20240101-20241231").
        pairs: Lista opcional de pares (ej. ["BTC/USDT", "ETH/USDT"]).
            Si es None usa los del pair_whitelist del config.

    Returns:
        Dict con el código de salida y el tail del stdout/stderr. El
        resumen tabular de Freqtrade está en el final del stdout.
    """
    cmd = [
        "docker",
        "compose",
        "run",
        "--rm",
        "freqtrade",
        "backtesting",
        "--strategy",
        strategy,
        "--timerange",
        timerange,
        "--export",
        "trades",
    ]
    if pairs:
        cmd += ["--pairs"] + pairs

    try:
        proc = subprocess.run(
            cmd,
            cwd=COMPOSE_DIR,
            capture_output=True,
            text=True,
            timeout=900,
        )
    except subprocess.TimeoutExpired:
        return {"error": "timeout (>15min)"}
    except FileNotFoundError:
        return {"error": "docker no encontrado en PATH"}

    return {
        "strategy": strategy,
        "timerange": timerange,
        "returncode": proc.returncode,
        "stdout_tail": proc.stdout[-4000:],
        "stderr_tail": proc.stderr[-1000:],
    }
