/**
 * Composition root: el único sitio donde las capas se conocen entre sí.
 */
import 'dotenv/config';
import { ProcessSignal } from './application/process-signal.js';
import { loadConfig } from './infrastructure/config.js';
import { CcxtGateway } from './infrastructure/exchange/ccxt-gateway.js';
import { PaperGateway } from './infrastructure/exchange/paper-gateway.js';
import { createLogger } from './infrastructure/logger.js';
import { openDb } from './infrastructure/persistence/db.js';
import { SqliteAlertLog } from './infrastructure/persistence/sqlite-alert-log.js';
import { SqlitePositionRepository } from './infrastructure/persistence/sqlite-position-repo.js';
import { createApp } from './interface/http/app.js';

const logger = createLogger();

let config;
try {
  config = loadConfig();
} catch (err) {
  logger.error({ err: err instanceof Error ? err.message : err }, 'arranque abortado');
  process.exit(1);
}

const db = openDb(config.DATA_DIR);
const positions = new SqlitePositionRepository(db);
const alertLog = new SqliteAlertLog(db);
const exchange =
  config.MODE === 'live'
    ? new CcxtGateway(config.CRYPTOCOM_API_KEY!, config.CRYPTOCOM_API_SECRET!)
    : new PaperGateway(logger);

const processSignal = new ProcessSignal(positions, alertLog, exchange, logger);
const app = createApp({ processSignal, webhookSecret: config.WEBHOOK_SECRET, logger });

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, mode: config.MODE }, 'webhook server arrancado');
});
