# language: es
Característica: Procesar señales de trading
  Como operador del bot
  Quiero que cada señal del webhook se traduzca en órdenes de forma segura
  Para no duplicar órdenes ni perder el control del estado de mis posiciones

  Antecedentes:
    Dado un sistema sin posiciones abiertas

  Escenario: Una señal de entrada abre una posición
    Cuando llega una señal de entrada long de "donchian" sobre "BTCUSDT" con qty 0.5 y stop 90000
    Entonces el resultado es "opened"
    Y existe una posición abierta en "BTC/USDT" con qty 0.5
    Y el exchange recibió 1 orden de apertura

  Escenario: Un reintento de TradingView no duplica la orden
    Cuando llega una señal de entrada long de "donchian" sobre "BTCUSDT" con qty 0.5 y stop 90000
    Y llega de nuevo la misma alerta
    Entonces el resultado es "duplicate"
    Y el exchange recibió 1 orden de apertura

  Escenario: Una entrada sobre un símbolo con posición abierta se ignora
    Dado una posición long abierta en "BTC/USDT" con qty 0.5 de la estrategia "donchian"
    Cuando llega una señal de entrada long de "donchian" sobre "BTCUSDT" con qty 0.3 y stop 91000
    Entonces el resultado es "skipped" por "position-already-open"
    Y el exchange recibió 0 órdenes de apertura
    Y existe una posición abierta en "BTC/USDT" con qty 0.5

  Escenario: Una salida sin posición abierta se ignora
    Cuando llega una señal de salida long de "donchian" sobre "BTCUSDT"
    Entonces el resultado es "skipped" por "no-open-position"
    Y el exchange no recibió ninguna orden de cierre

  Escenario: Una salida cierra la posición abierta
    Dado una posición long abierta en "BTC/USDT" con qty 0.5 de la estrategia "donchian"
    Cuando llega una señal de salida long de "donchian" sobre "BTCUSDT"
    Entonces el resultado es "closed"
    Y no queda ninguna posición abierta en "BTC/USDT"
    Y el exchange recibió 1 orden de cierre

  Escenario: Si el exchange falla al abrir, el estado local no cambia
    Dado que el exchange fallará en la siguiente orden
    Cuando llega una señal de entrada long de "donchian" sobre "BTCUSDT" con qty 0.5 y stop 90000
    Entonces el resultado es "failed"
    Y no queda ninguna posición abierta en "BTC/USDT"

  Escenario: Si el exchange falla al cerrar, la posición se conserva
    Dado una posición long abierta en "BTC/USDT" con qty 0.5 de la estrategia "donchian"
    Y que el exchange fallará en la siguiente orden
    Cuando llega una señal de salida long de "donchian" sobre "BTCUSDT"
    Entonces el resultado es "failed"
    Y existe una posición abierta en "BTC/USDT" con qty 0.5

  Escenario: Cada símbolo mantiene su posición de forma independiente
    Dado una posición long abierta en "ETH/USDT" con qty 2 de la estrategia "donchian"
    Cuando llega una señal de entrada long de "donchian" sobre "BTCUSDT" con qty 0.5 y stop 90000
    Entonces el resultado es "opened"
    Y existe una posición abierta en "BTC/USDT" con qty 0.5
    Y existe una posición abierta en "ETH/USDT" con qty 2
