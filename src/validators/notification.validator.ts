import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164-ish: optional +, 8-15 digits, no leading 0.
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export const notificationSchema = z
  .object({
    channel: z.enum(['sms', 'email', 'whatsapp'], {
      errorMap: () => ({ message: 'channel must be one of: sms, email, whatsapp' }),
    }),
    to: z.string().min(3, 'to is required'),
    message: z.string().min(1, 'message is required').max(2000, 'message is too long (max 2000 chars)'),
    subject: z.string().max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'email') {
      if (!EMAIL_REGEX.test(data.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: 'to must be a valid email address when channel is "email"',
        });
      }
    } else {
      // sms + whatsapp both expect a phone number
      if (!PHONE_REGEX.test(data.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: 'to must be a valid phone number in E.164 format, e.g. +254712345678',
        });
      }
    }
  });

export type NotificationInput = z.infer<typeof notificationSchema>;
