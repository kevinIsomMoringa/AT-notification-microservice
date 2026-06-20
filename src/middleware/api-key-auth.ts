import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Simple shared-secret auth via the x-api-key header. Good enough for a
 * service-to-service demo; swap for JWT/OAuth if this goes further than that.
 * If SERVICE_API_KEY isn't set, auth is skipped (handy for local dev).
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  if (!env.SERVICE_API_KEY) {
    return next();
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
