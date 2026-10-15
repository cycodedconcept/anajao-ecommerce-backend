import 'dotenv/config';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { createDatabase } from './database/client.js';
const config = parseEnv(process.env);
const logger = createLogger(config.LOG_LEVEL);
const database = createDatabase(config);
let shuttingDown = false;
const app = createApp(config, database, logger, () => shuttingDown);
const server = app.listen(config.PORT, config.HOST, () => {
  logger.info({ port: config.PORT }, 'Server listening');
  void database.ping().then(
    () => logger.info('Connected to database successfully'),
    () => logger.error('Database connection failed'),
  );
});
async function shutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  timer.unref();
  try {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.disconnect();
    clearTimeout(timer);
    process.exitCode = exitCode;
  } catch {
    logger.error('Shutdown failed');
    process.exitCode = 1;
  }
}
process.once('SIGTERM', () => {
  void shutdown(0);
});
process.once('SIGINT', () => {
  void shutdown(0);
});
server.on('error', () => {
  logger.error('Server failed to listen');
  void shutdown(1);
});
