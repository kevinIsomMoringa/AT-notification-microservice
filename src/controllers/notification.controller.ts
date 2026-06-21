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
    const publicResult = { ...result };
    delete publicResult.raw;

    const statusCode = publicResult.provider === 'queue' ? 202 : publicResult.success ? 200 : 502;

    return res.status(statusCode).json({
      ...publicResult,
      metadata: metadata ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
