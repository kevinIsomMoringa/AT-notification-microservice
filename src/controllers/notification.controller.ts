import { Request, Response, NextFunction } from 'express';
import { notificationSchema } from '../validators/notification.validator';
import { NotificationService } from '../services/notification.service';

const notificationService = new NotificationService();

export async function sendNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = notificationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { channel, to, message, subject, metadata } = parsed.data;

    const result = await notificationService.dispatch(channel, { to, message, subject, metadata });

    // The request was well-formed either way — a provider failure (bad
    // credentials, carrier rejection, etc.) is a 502, not a 400/500.
    const statusCode = result.success ? 200 : 502;

    return res.status(statusCode).json({
      ...result,
      metadata: metadata ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
