import africastalking from 'africastalking';
import { env, assertConfigured } from '../config/env';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';

// africastalking's typings are loose (it's a JS-first SDK), so we keep the
// client `any`-shaped here and lean on our own types everywhere else.
let smsClient: any = null;

function getSmsClient() {
  if (!smsClient) {
    assertConfigured('sms', {
      AT_USERNAME: env.AT_USERNAME,
      AT_API_KEY: env.AT_API_KEY,
    });

    const at = africastalking({
      apiKey: env.AT_API_KEY,
      username: env.AT_USERNAME,
    });

    smsClient = at.SMS;
  }
  return smsClient;
}

export class SmsProvider implements NotificationProvider {
  readonly channel = 'sms' as const;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const sms = getSmsClient();

      const response = await sms.send({
        to: [payload.to],
        message: payload.message,
        ...(env.AT_SENDER_ID ? { from: env.AT_SENDER_ID } : {}),
      });

      const recipient = response?.SMSMessageData?.Recipients?.[0];

      if (!recipient || !/Success/i.test(recipient.status)) {
        throw new Error(recipient?.status || 'Africa\'s Talking returned no recipient status');
      }

      return {
        success: true,
        channel: this.channel,
        provider: 'africastalking',
        externalId: recipient.messageId,
        status: recipient.status,
        raw: response,
      };
    } catch (error) {
      return {
        success: false,
        channel: this.channel,
        provider: 'africastalking',
        status: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  }
}
