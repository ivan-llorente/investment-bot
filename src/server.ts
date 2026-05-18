import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import ccxt from 'ccxt';
import 'dotenv/config';
import pino from 'pino';

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const SECRET = process.env.WEBHOOK_SECRET ?? '';
const MODE = (process.env.MODE ?? 'paper') as 'paper' | 'live';

if (!SECRET || SECRET === 'changeme') {
  logger.error('WEBHOOK_SECRET no configurado en .env');
  process.exit(1);
}

const exchange =
  MODE === 'live'
    ? new ccxt.cryptocom({
        apiKey: process.env.CRYPTOCOM_API_KEY,
        secret: process.env.CRYPTOCOM_API_SECRET,
      })
    : null;

type AlertPayload = {
  secret: string;
  strategy: string;
  ticker: string;
  exchange: string;
  interval: string;
  action: 'entry' | 'exit';
  side: 'long' | 'short';
  price: string;
  time: string;
  qty: string;
  stop: string;
};

// Estado en memoria del tamaño abierto por símbolo. Se pierde en reinicios:
// aceptable para v1 / paper. Para live persistente, mover a SQLite o leer
// el balance del exchange antes de cerrar.
const openQty = new Map<string, number>();

const app = express();
// TradingView envía el body como text/plain por defecto.
app.use(express.text({ type: '*/*', limit: '16kb' }));

app.get('/health', (_req, res) => res.send('ok'));

app.post('/webhook', async (req: Request, res: Response) => {
  let payload: AlertPayload;
  try {
    payload = JSON.parse(req.body as unknown as string);
  } catch {
    logger.warn({ body: req.body }, 'JSON inválido');
    return res.status(400).send('bad json');
  }

  if (!safeEqual(payload.secret, SECRET)) {
    logger.warn({ ip: req.ip }, 'secret inválido');
    return res.status(401).send('unauthorized');
  }

  const symbol = normalizeSymbol(payload.ticker);
  const qty = Number.parseFloat(payload.qty);
  const stop = Number.parseFloat(payload.stop);
  const ctx = {
    strategy: payload.strategy,
    symbol,
    interval: payload.interval,
    action: payload.action,
    side: payload.side,
    price: payload.price,
    qty,
    stop,
  };

  logger.info(ctx, 'alerta recibida');

  if (MODE === 'paper' || !exchange) {
    if (payload.action === 'entry') {
      openQty.set(symbol, qty);
    } else {
      openQty.delete(symbol);
    }
    logger.info({ ...ctx, openQty: openQty.get(symbol) ?? 0 }, '[PAPER] orden simulada');
    return res.status(200).send('ok');
  }

  try {
    if (payload.action === 'entry') {
      const side = payload.side === 'long' ? 'buy' : 'sell';
      const entry = await exchange.createMarketOrder(symbol, side, qty);
      logger.info({ orderId: entry.id }, 'entry colocada');

      const stopSide = payload.side === 'long' ? 'sell' : 'buy';
      const stopOrder = await exchange.createOrder(
        symbol,
        'stop',
        stopSide,
        qty,
        undefined,
        { stopPrice: stop, triggerPrice: stop, reduceOnly: true },
      );
      logger.info({ orderId: stopOrder.id, stop }, 'stop colocado');
      openQty.set(symbol, qty);
    } else {
      const closeQty = openQty.get(symbol);
      if (!closeQty) {
        logger.warn({ symbol }, 'exit sin posición conocida; ignorado');
        return res.status(200).send('no position');
      }
      const side = payload.side === 'long' ? 'sell' : 'buy';
      const closeOrder = await exchange.createMarketOrder(symbol, side, closeQty);
      logger.info({ orderId: closeOrder.id, closeQty }, 'exit ejecutada');
      openQty.delete(symbol);
    }
    return res.status(200).send('ok');
  } catch (err) {
    logger.error({ err }, 'fallo al ejecutar orden');
    return res.status(500).send('order failed');
  }
});

function safeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeSymbol(tvTicker: string): string {
  // TradingView entrega "BTCUSDT", ccxt espera "BTC/USDT".
  const quotes = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'EUR'];
  for (const q of quotes) {
    if (tvTicker.endsWith(q)) {
      return `${tvTicker.slice(0, -q.length)}/${q}`;
    }
  }
  return tvTicker;
}

app.listen(PORT, () => {
  logger.info(`webhook escuchando en :${PORT} (mode=${MODE})`);
});
