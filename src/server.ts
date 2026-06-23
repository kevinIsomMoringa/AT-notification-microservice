import { createApp } from './app';
import { env } from './config/env';
import { validateStartupConfig } from './config/startup';
import { logger } from './config/logger';

validateStartupConfig();

const app = createApp();

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  process.exit(1);
});

app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      health: `/health`,
      ready: `/ready`,
      metrics: `/metrics`,
      docs: `/docs`,
      openapi: `/openapi.json`,
    },
    'Notification microservice listening'
  );
});
