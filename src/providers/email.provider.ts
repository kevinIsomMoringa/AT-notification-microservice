import nodemailer, { Transporter } from 'nodemailer';
import { env, assertConfigured } from '../config/env';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    assertConfigured('email', {
      SMTP_HOST: env.SMTP_HOST,
      SMTP_USER: env.SMTP_USER,
      SMTP_PASS: env.SMTP_PASS,
      SMTP_FROM: env.SMTP_FROM,
    });

    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // true for 465 (SSL), false for 587/25 (STARTTLS)
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export class EmailProvider implements NotificationProvider {
  readonly channel = 'email' as const;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const mailer = getTransporter();

      const info = await mailer.sendMail({
        from: env.SMTP_FROM,
        to: payload.to,
        subject: payload.subject || 'Notification',
        text: payload.message,
      });

      return {
        success: true,
        channel: this.channel,
        provider: 'smtp',
        externalId: info.messageId,
        status: 'sent',
        raw: info,
      };
    } catch (error) {
      return {
        success: false,
        channel: this.channel,
        provider: 'smtp',
        status: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }
}
