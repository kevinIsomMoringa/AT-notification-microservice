import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'notification_' });

export const requestCounter = new client.Counter({
  name: 'notification_requests_total',
  help: 'Total HTTP requests received',
  labelNames: ['method', 'route', 'status'],
});

export const requestDuration = new client.Histogram({
  name: 'notification_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const providerSuccessCounter = new client.Counter({
  name: 'notification_provider_success_total',
  help: 'Provider success count',
  labelNames: ['channel', 'provider'],
});

export const providerFailureCounter = new client.Counter({
  name: 'notification_provider_failure_total',
  help: 'Provider failure count',
  labelNames: ['channel', 'provider', 'reason'],
});

register.registerMetric(requestCounter);
register.registerMetric(requestDuration);
register.registerMetric(providerSuccessCounter);
register.registerMetric(providerFailureCounter);

export const metricsRegistry = register;

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = requestDuration.startTimer({
    method: req.method,
    route: req.path,
    status: 'unknown',
  });

  res.once('finish', () => {
    const status = String(res.statusCode);
    requestCounter.inc({ method: req.method, route: req.path, status });
    end({ method: req.method, route: req.path, status });
  });

  next();
}
