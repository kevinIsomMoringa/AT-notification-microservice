import { randomUUID } from 'crypto';
import {
  Channel,
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from '../providers/notification-provider.interface';
import { SmsProvider } from '../providers/sms.provider';
import { EmailProvider } from '../providers/email.provider';
import { WhatsappProvider } from '../providers/whatsapp.provider';
import { NotificationQueue } from './notification.queue';
import { NotificationStore } from './notification.store';

/**
 * Single entry point for "send this message somehow". Callers only know
 * about `channel` + a payload — they never touch a provider SDK directly.
 * In production we enqueue work locally and return 202 accepted while the
 * worker retries failed provider calls asynchronously.
 */
export class NotificationService {
  private readonly providers: Map<Channel, NotificationProvider>;
  private readonly queue: NotificationQueue;
  private readonly store: NotificationStore;

  constructor() {
    this.providers = new Map<Channel, NotificationProvider>([
      ['sms', new SmsProvider()],
      ['email', new EmailProvider()],
      ['whatsapp', new WhatsappProvider()],
    ]);
    this.store = new NotificationStore();
    this.queue = new NotificationQueue(this.providers, this.store);
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

    const jobId = randomUUID();
    await this.store.recordRequest(jobId, channel, payload);
    this.queue.enqueue({
      id: jobId,
      channel,
      payload,
      attempts: 0,
    });

    return {
      success: true,
      channel,
      provider: 'queue',
      externalId: jobId,
      status: 'queued',
    };
  }
}
