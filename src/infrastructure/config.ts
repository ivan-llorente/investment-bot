/**
 * Carga y validación del entorno. Falla en arranque (fail-fast) si la
 * configuración es inválida — nunca a mitad de un trade.
 */
import { z } from 'zod';

const envSchema = z
  .object({
    MODE: z.enum(['paper', 'live']).default('paper'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    WEBHOOK_SECRET: z
      .string()
      .min(16, 'WEBHOOK_SECRET debe tener al menos 16 caracteres (usa: openssl rand -hex 32)')
      .refine((s) => s !== 'changeme', 'WEBHOOK_SECRET no puede ser el valor de ejemplo'),
    DATA_DIR: z.string().default('./data'),
    CRYPTOCOM_API_KEY: z.string().optional(),
    CRYPTOCOM_API_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MODE === 'live' && (!env.CRYPTOCOM_API_KEY || !env.CRYPTOCOM_API_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MODE=live requiere CRYPTOCOM_API_KEY y CRYPTOCOM_API_SECRET',
      });
    }
  });

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  return parsed.data;
}
