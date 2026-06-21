import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

declare global {
  // eslint-disable-next-line no-var
  var __notificationMetricsRegistry: client.Registry | undefined;
}

const register = globalThis.__notificationMetricsRegistry ?? new client.Registry();

function getOrCreateCounter(config: client.CounterConfiguration<string>) {
  const existing = register.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Counter<string>;
  }

  return new client.Counter({ ...config, registers: [register] });
}

function getOrCreateHistogram(config: client.HistogramConfiguration<string>) {
  const existing = register.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Histogram<string>;
  }

  return new client.Histogram({ ...config, registers: [register] });
}

if (!globalThis.__notificationMetricsRegistry) {
  globalThis.__notificationMetricsRegistry = register;
  client.collectDefaultMetrics({ register, prefix: 'notification_' });
}

export const requestCounter = getOrCreateCounter({
  name: 'notification_requests_total',
  help: 'Total HTTP requests received',
  labelNames: ['method', 'route', 'status'],
});

export const requestDuration = getOrCreateHistogram({
  name: 'notification_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const providerSuccessCounter = getOrCreateCounter({
  name: 'notification_provider_success_total',
  help: 'Provider success count',
  labelNames: ['channel', 'provider'],
});

export const providerFailureCounter = getOrCreateCounter({
  name: 'notification_provider_failure_total',
  help: 'Provider failure count',
  labelNames: ['channel', 'provider', 'reason'],
});

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
