# language: es
Característica: Validación de señales en la frontera del dominio
  Las alertas externas solo entran al sistema como un TradeSignal válido.
  Una señal malformada se rechaza antes de tocar el exchange o el estado.

  Escenario: Una entrada sin stop se rechaza
    Cuando intento construir una señal de entrada sin stop
    Entonces la señal es rechazada

  Escenario: Una entrada con qty cero se rechaza
    Cuando intento construir una señal de entrada con qty 0
    Entonces la señal es rechazada

  Escenario: Una entrada con qty negativa se rechaza
    Cuando intento construir una señal de entrada con qty -1
    Entonces la señal es rechazada

  Escenario: Una salida no requiere qty ni stop
    Cuando intento construir una señal de salida sin qty ni stop
    Entonces la señal se construye correctamente

  Esquema del escenario: El ticker de TradingView se normaliza al formato del exchange
    Cuando intento construir una señal de entrada sobre "<ticker>"
    Entonces la señal apunta al símbolo "<simbolo>"

    Ejemplos:
      | ticker   | simbolo  |
      | BTCUSDT  | BTC/USDT |
      | ETHUSDC  | ETH/USDC |
      | SOLBTC   | SOL/BTC  |
      | XRPUSDT  | XRP/USDT |
      | XRPUSD   | XRP/USD  |
      | BTC/USDT | BTC/USDT |
