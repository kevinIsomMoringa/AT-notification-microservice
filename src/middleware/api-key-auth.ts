import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Simple shared-secret auth via the x-api-key header.
 * In production the key is required; in development it is optional.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const skipAuth = env.NODE_ENV !== 'production' && !env.SERVICE_API_KEY;
  if (skipAuth) {
    return next();
  }

  if (!env.SERVICE_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Service API key is not configured',
    });
  }

  const key = req.header('x-api-key');

  if (key !== env.SERVICE_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing x-api-key header',
    });
  }

  return next();
}
