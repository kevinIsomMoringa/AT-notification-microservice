import twilio, { Twilio } from 'twilio';
import { env, assertConfigured } from '../config/env';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';

let client: Twilio | null = null;

function getClient(): Twilio {
  if (!client) {
    assertConfigured('whatsapp', {
      TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_NUMBER: env.TWILIO_WHATSAPP_NUMBER,
    });
    client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

export class WhatsappProvider implements NotificationProvider {
  readonly channel = 'whatsapp' as const;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const twilioClient = getClient();

      const message = await twilioClient.messages.create({
        from: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${payload.to}`,
        body: payload.message,
      });

      return {
        success: true,
        channel: this.channel,
        provider: 'twilio',
        externalId: message.sid,
        status: message.status,
        raw: message,
      };
    } catch (error) {
      return {
        success: false,
        channel: this.channel,
        provider: 'twilio',
        status: error instanceof Error ? error.message : 'Failed to send WhatsApp message',
      };
    }
  }
}
