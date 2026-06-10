/**
 * Capa de interfaz HTTP. Responsabilidades: parsear, validar el secret
 * (timing-safe), validar forma con Zod, construir el value object del
 * dominio y delegar en el caso de uso. Nada de lógica de negocio aquí.
 *
 * Nota de seguridad: TradingView no soporta headers personalizados, por
 * lo que la autenticación va en el body (campo secret) sobre HTTPS.
 * Nunca loguear el body crudo: contiene el secret.
 */
import { timingSafeEqual } from 'node:crypto';
import express, { type Express } from 'express';
import type { ProcessSignal } from '../../application/process-signal.js';
import type { Logger } from '../../domain/ports.js';
import { InvalidSignalError, TradeSignal } from '../../domain/signal.js';
import { webhookPayloadSchema } from './webhook-schema.js';

export interface AppDeps {
  processSignal: ProcessSignal;
  webhookSecret: string;
  logger: Logger;
}

export function createApp({ processSignal, webhookSecret, logger }: AppDeps): Express {
  const app = express();
  // TradingView envía text/plain por defecto.
  app.use(express.text({ type: '*/*', limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).send('ok');
  });

  app.post('/webhook', async (req, res) => {
    let raw: unknown;
    try {
      raw = JSON.parse(typeof req.body === 'string' ? req.body : '');
    } catch {
      logger.warn({ ip: req.ip }, 'webhook con JSON inválido');
      return res.status(400).json({ error: 'invalid json' });
    }

    const parsed = webhookPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ ip: req.ip, issues: parsed.error.issues }, 'webhook con payload inválido');
      return res.status(400).json({ error: 'invalid payload' });
    }
    const payload = parsed.data;

    if (!safeEqual(payload.secret, webhookSecret)) {
      logger.warn({ ip: req.ip }, 'webhook con secret inválido');
      return res.status(401).json({ error: 'unauthorized' });
    }

    let signal: TradeSignal;
    try {
      const props = {
        strategy: payload.strategy,
        ticker: payload.ticker,
        side: payload.side,
        at: payload.time,
        qty: payload.qty,
        stopPrice: payload.stop,
      };
      signal = payload.action === 'entry' ? TradeSignal.entry(props) : TradeSignal.exit(props);
    } catch (err) {
      if (err instanceof InvalidSignalError) {
        logger.warn({ ip: req.ip, reason: err.message }, 'señal inválida rechazada');
        return res.status(422).json({ error: err.message });
      }
      throw err;
    }

    const outcome = await processSignal.execute(signal);
    const httpStatus = outcome.status === 'failed' ? 500 : 200;
    return res.status(httpStatus).json(outcome);
  });

  return app;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
