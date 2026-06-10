/**
 * Schema de la frontera: valida la forma cruda del JSON de TradingView
 * antes de construir el value object del dominio. Los números llegan
 * como strings (limitación de los placeholders de TV), de ahí coerce.
 */
import { z } from 'zod';

export const webhookPayloadSchema = z.object({
  secret: z.string().min(1),
  strategy: z.string().min(1),
  ticker: z.string().min(1),
  action: z.enum(['entry', 'exit']),
  side: z.enum(['long', 'short']),
  time: z.string().min(1),
  qty: z.coerce.number().nonnegative().optional(),
  stop: z.coerce.number().nonnegative().optional(),
  // Campos informativos que algunas estrategias incluyen.
  price: z.coerce.number().optional(),
  target: z.coerce.number().optional(),
  exchange: z.string().optional(),
  interval: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
