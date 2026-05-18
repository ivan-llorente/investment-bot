"""REPL de un agente Strands que supervisa el bot Freqtrade local."""
from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from strands import Agent
from strands.models import AnthropicModel

from tools import (
    list_strategies,
    open_trades,
    performance_summary,
    recent_trades,
    run_backtest,
)

SYSTEM_PROMPT = """Eres un asistente de trading que supervisa un bot Freqtrade.

Tienes tools para:
- list_strategies(): listar estrategias en user_data/strategies
- run_backtest(strategy, timerange, pairs?): correr un backtest
- recent_trades(limit): leer trades cerrados recientes de la DB
- open_trades(): leer posiciones abiertas
- performance_summary(days): agregado de winrate, P&L, mejor/peor

NO ejecutas órdenes: el motor Freqtrade decide entradas y salidas según las
estrategias. Tu papel es analizar, resumir y sugerir ajustes.

Cuando reportes performance muestra los números reales. Evita afirmaciones
sobre retornos futuros. Si una métrica empeora respecto al backtest,
señálalo y propón hipótesis (overfit, cambio de régimen, ejecución).
"""


def main() -> int:
    load_dotenv()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY no configurada (.env)", file=sys.stderr)
        return 1
    model_id = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

    agent = Agent(
        model=AnthropicModel(
            model_id=model_id,
            client_args={"api_key": api_key},
            max_tokens=4096,
        ),
        system_prompt=SYSTEM_PROMPT,
        tools=[
            list_strategies,
            run_backtest,
            recent_trades,
            open_trades,
            performance_summary,
        ],
    )

    print(f"Agente listo ({model_id}). Escribe 'salir' para terminar.\n")
    while True:
        try:
            user_input = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if user_input.lower() in {"salir", "exit", "quit", ":q"}:
            break
        if not user_input:
            continue
        response = agent(user_input)
        print(f"\n{response.message}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
