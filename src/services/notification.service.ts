import {
  Channel,
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from '../providers/notification-provider.interface';
import { SmsProvider } from '../providers/sms.provider';
import { EmailProvider } from '../providers/email.provider';
import { WhatsappProvider } from '../providers/whatsapp.provider';

/**
 * Single entry point for "send this message somehow". Callers only know
 * about `channel` + a payload — they never touch a provider SDK directly.
 * Adding a new channel later (e.g. push notifications) means writing one
 * new provider class and registering it here. Nothing else changes.
 */
export class NotificationService {
  private readonly providers: Map<Channel, NotificationProvider>;

  constructor() {
    this.providers = new Map<Channel, NotificationProvider>([
      ['sms', new SmsProvider()],
      ['email', new EmailProvider()],
      ['whatsapp', new WhatsappProvider()],
    ]);
  }

  async dispatch(channel: Channel, payload: NotificationPayload): Promise<NotificationResult> {
    const provider = this.providers.get(channel);

    if (!provider) {
      return {
        success: false,
        channel,
        provider: 'none',
        status: `No provider registered for channel: ${channel}`,
      };
    }

    return provider.send(payload);
  }
}
