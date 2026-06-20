import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import notificationRoutes from './routes/notification.routes';
import { apiKeyAuth } from './middleware/api-key-auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'notification-microservice',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1', apiKeyAuth, notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
