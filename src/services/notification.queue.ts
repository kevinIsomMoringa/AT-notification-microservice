import { Channel, NotificationPayload, NotificationProvider, NotificationResult } from '../providers/notification-provider.interface';
import { NotificationStore } from './notification.store';
import { providerFailureCounter, providerSuccessCounter } from '../config/metrics';

const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 30_000;

export interface NotificationJob {
  id: string;
  channel: Channel;
  payload: NotificationPayload;
  attempts: number;
}

export class NotificationQueue {
  private readonly queue: NotificationJob[] = [];
  private running = false;

  constructor(
    private readonly providers: Map<Channel, NotificationProvider>,
    private readonly store: NotificationStore
  ) {}

  enqueue(job: NotificationJob) {
    this.queue.push(job);
    void this.processQueue();
    return job;
  }

  private async processQueue() {
    if (this.running) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await this.processJob(job);
    }

    this.running = false;
  }

  private getRetryDelay(attempts: number) {
    return Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
  }

  private async processJob(job: NotificationJob) {
    const provider = this.providers.get(job.channel);
    if (!provider) {
      await this.store.recordJob(job.id, 'none', 'failed', job.attempts, `No provider configured for ${job.channel}`);
      providerFailureCounter.inc({ channel: job.channel, provider: 'none', reason: 'missing_provider' });
      return;
    }

    const attempt = job.attempts + 1;
    await this.store.recordJob(job.id, provider.channel, 'processing', attempt);

    try {
      const result: NotificationResult = await provider.send(job.payload);

      if (result.success) {
        await this.store.recordOutcome(job.id, true, result.provider, result.status);
        providerSuccessCounter.inc({ channel: job.channel, provider: result.provider });
        return;
      }

      const errorReason = result.status || 'provider_error';
      providerFailureCounter.inc({ channel: job.channel, provider: result.provider, reason: errorReason });

      if (attempt < MAX_ATTEMPTS) {
        await this.store.recordJob(job.id, result.provider, 'retrying', attempt, errorReason);
        const delayMs = this.getRetryDelay(attempt);
        setTimeout(() => {
          this.enqueue({ ...job, attempts: attempt });
        }, delayMs);
        return;
      }

      await this.store.recordOutcome(job.id, false, result.provider, result.status, errorReason);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown queue error';
      providerFailureCounter.inc({ channel: job.channel, provider: provider.channel, reason: 'exception' });

      if (attempt < MAX_ATTEMPTS) {
        await this.store.recordJob(job.id, provider.channel, 'retrying', attempt, message);
        const delayMs = this.getRetryDelay(attempt);
        setTimeout(() => {
          this.enqueue({ ...job, attempts: attempt });
        }, delayMs);
        return;
      }

      await this.store.recordOutcome(job.id, false, provider.channel, 'failed', message);
    }
  }
}
