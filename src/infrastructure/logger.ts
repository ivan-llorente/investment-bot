import pino from 'pino';
import type { Logger } from '../domain/ports.js';

export function createLogger(): Logger {
  return pino({
    transport: { target: 'pino-pretty', options: { colorize: true } },
    redact: ['secret', '*.secret'],
  });
}
