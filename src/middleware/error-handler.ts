import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

function isJsonParseError(err: unknown): err is SyntaxError & { status: number; body: unknown } {
  return (
    err instanceof SyntaxError &&
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: unknown }).status === 400 &&
    'body' in err
  );
}

function getStatusCode(err: unknown): number {
  if (isJsonParseError(err)) {
    return 400;
  }

  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const statusCode = (err as { statusCode: unknown }).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) {
      return statusCode;
    }
  }

  return 500;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const statusCode = getStatusCode(err);

  if (statusCode >= 500) {
    logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  } else {
    logger.warn({ err, method: req.method, url: req.originalUrl }, 'Client error');
  }

  if (isJsonParseError(err)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body',
    });
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Internal server error' : 'Request failed',
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
