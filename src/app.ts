import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import notificationRoutes from './routes/notification.routes';
import diagnosticsRoutes from './routes/diagnostics.routes';
import { apiKeyAuth } from './middleware/api-key-auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { metricsMiddleware, metricsRegistry } from './config/metrics';
import { env } from './config/env';
import { logger } from './config/logger';

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
    });
  },
});

export function createApp() {
  const app = express();

  app.set('trust proxy', true);

  // pino and pino-http ship slightly mismatched Logger types across versions.
  app.use(pinoHttp({ logger: logger as never }));
  app.use(helmet());
  app.use(
    cors({
      origin:
        env.CORS_ORIGINS.length > 0
          ? env.CORS_ORIGINS
          : process.env.NODE_ENV === 'production'
          ? false
          : true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(metricsMiddleware);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'notification-microservice',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      service: 'notification-microservice',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  });

  // Diagnostics web view (HTML) + JSON log snapshot.
  // Kept unauthenticated to be easy to use locally; in production it is disabled unless enabled via env.
  app.use(diagnosticsRoutes);

  app.use('/api/v1/notifications', limiter);
  app.use('/api/v1', apiKeyAuth, notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
