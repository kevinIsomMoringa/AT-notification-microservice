import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationQueue } from '../../src/services/notification.queue';
import { NotificationStore } from '../../src/services/notification.store';
import {
  Channel,
  NotificationProvider,
  NotificationResult,
} from '../../src/providers/notification-provider.interface';
import { readStoreEntries, waitForStoreJob, waitForStoreOutcome } from '../helpers/store';

function createProvider(
  channel: Channel,
  send: NotificationProvider['send']
): NotificationProvider {
  return { channel, send };
}

describe('NotificationQueue', () => {
  let storePath: string;
  let store: NotificationStore;

  beforeEach(() => {
    const storeDir = mkdtempSync(join(tmpdir(), 'notification-queue-test-'));
    storePath = join(storeDir, 'notifications.log');
    store = new NotificationStore(storePath);
  });

  it('processes successful jobs and records outcomes', async () => {
    const send = vi.fn().mockResolvedValue({
      success: true,
      channel: 'sms',
      provider: 'africastalking',
      externalId: 'ATXid_1',
      status: 'Success',
    } satisfies NotificationResult);

    const queue = new NotificationQueue(new Map<Channel, NotificationProvider>([
      ['sms', createProvider('sms', send)],
    ]), store);

    queue.enqueue({
      id: 'job-success',
      channel: 'sms',
      payload: { to: '+254712345678', message: 'Hello' },
      attempts: 0,
    });

    const outcome = await waitForStoreOutcome(storePath, 'job-success');
    expect(outcome.success).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it('retries failed jobs up to three attempts', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({
        success: false,
        channel: 'email',
        provider: 'smtp',
        status: 'temporary failure',
      } satisfies NotificationResult);

    const queue = new NotificationQueue(new Map<Channel, NotificationProvider>([
      ['email', createProvider('email', send)],
    ]), store);

    queue.enqueue({
      id: 'job-retry',
      channel: 'email',
      payload: { to: 'user@example.com', message: 'Hello' },
      attempts: 0,
    });

    const outcome = await waitForStoreOutcome(storePath, 'job-retry', 15_000);
    expect(outcome.success).toBe(false);
    expect(send).toHaveBeenCalledTimes(3);

    const retryEntries = readStoreEntries(storePath).filter(
      (entry) => entry.recordType === 'job' && entry.status === 'retrying'
    );
    expect(retryEntries.length).toBeGreaterThanOrEqual(2);
  });

  it('records a failure when no provider is registered for the channel', async () => {
    const queue = new NotificationQueue(new Map<Channel, NotificationProvider>(), store);

    queue.enqueue({
      id: 'job-missing-provider',
      channel: 'whatsapp',
      payload: { to: '+254712345678', message: 'Hello' },
      attempts: 0,
    });

    const job = await waitForStoreJob(storePath, 'job-missing-provider', 'failed');
    expect(job.provider).toBe('none');
    expect(job.error).toContain('No provider configured');
  });
});
