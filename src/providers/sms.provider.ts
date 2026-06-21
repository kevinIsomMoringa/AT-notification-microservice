import africastalking from 'africastalking';
import { env, assertConfigured } from '../config/env';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from './notification-provider.interface';
import { withTimeout } from '../utils/with-timeout';

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

      const response = (await withTimeout(
        sms.send({
          to: [payload.to],
          message: payload.message,
          ...(env.AT_SENDER_ID ? { from: env.AT_SENDER_ID } : {}),
        }),
        env.PROVIDER_TIMEOUT_MS,
        'Africa\'s Talking request timed out'
      )) as {
        SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string }> };
      };

      const recipient = response.SMSMessageData?.Recipients?.[0];
      const recipientStatus = recipient?.status;

      if (!recipientStatus || !/Success/i.test(recipientStatus)) {
        throw new Error(recipientStatus || 'Africa\'s Talking returned no recipient status');
      }

      if (!recipient?.messageId) {
        throw new Error('Africa\'s Talking returned no message id');
      }

      return {
        success: true,
        channel: this.channel,
        provider: 'africastalking',
        externalId: recipient.messageId,
        status: recipientStatus,
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
