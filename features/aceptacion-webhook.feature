# language: es
Característica: Webhook de TradingView de extremo a extremo
  El sistema se ejercita desde la frontera HTTP con el cableado real:
  Express, validación Zod, caso de uso y SQLite. El único doble es el
  gateway del exchange, que registra las órdenes en lugar de enviarlas.

  Antecedentes:
    Dado el servidor del bot en marcha

  Escenario: Ciclo de vida completo de una posición
    Cuando envío por HTTP una alerta de entrada válida sobre "BTCUSDT"
    Entonces la respuesta HTTP es 200 con estado "opened"
    Y la base de datos contiene una posición en "BTC/USDT"
    Cuando reenvío por HTTP la misma alerta
    Entonces la respuesta HTTP es 200 con estado "duplicate"
    Y el gateway recibió exactamente 1 orden de apertura
    Cuando envío por HTTP la alerta de salida correspondiente
    Entonces la respuesta HTTP es 200 con estado "closed"
    Y la base de datos no contiene ninguna posición en "BTC/USDT"

  Escenario: Un cuerpo que no es JSON se rechaza
    Cuando envío por HTTP un cuerpo que no es JSON
    Entonces la respuesta HTTP es 400
    Y el gateway no recibió ninguna orden

  Escenario: Un secret incorrecto se rechaza sin revelar información
    Cuando envío por HTTP una alerta de entrada con secret incorrecto
    Entonces la respuesta HTTP es 401
    Y el gateway no recibió ninguna orden

  Escenario: Un payload sin los campos obligatorios se rechaza
    Cuando envío por HTTP una alerta sin los campos obligatorios
    Entonces la respuesta HTTP es 400
    Y el gateway no recibió ninguna orden

  Escenario: Una entrada sin stop viola un invariante del dominio
    Cuando envío por HTTP una alerta de entrada sin stop
    Entonces la respuesta HTTP es 422
    Y el gateway no recibió ninguna orden

  Escenario: Una salida sin posición abierta se acepta pero no opera
    Cuando envío por HTTP una alerta de salida sobre "BTCUSDT"
    Entonces la respuesta HTTP es 200 con estado "skipped"
    Y el gateway no recibió ninguna orden

  Escenario: El healthcheck responde
    Cuando consulto el healthcheck por HTTP
    Entonces la respuesta HTTP es 200
