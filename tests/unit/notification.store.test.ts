import { join } from 'path';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { NotificationStore } from '../../src/services/notification.store';

describe('NotificationStore', () => {
  it('creates the store file and appends request, job, and outcome records', async () => {
    const storeDir = mkdtempSync(join(tmpdir(), 'notification-store-test-'));
    const storePath = join(storeDir, 'notifications.log');
    const store = new NotificationStore(storePath);

    await store.recordRequest('job-1', 'sms', {
      to: '+254712345678',
      message: 'Hello',
    });
    await store.recordJob('job-1', 'africastalking', 'processing', 1);
    await store.recordOutcome('job-1', true, 'africastalking', 'Success');

    const lines = readFileSync(storePath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(3);

    const entries = lines.map((line) => JSON.parse(line));
    expect(entries[0]).toMatchObject({ recordType: 'request', jobId: 'job-1', channel: 'sms' });
    expect(entries[1]).toMatchObject({ recordType: 'job', jobId: 'job-1', status: 'processing' });
    expect(entries[2]).toMatchObject({
      recordType: 'outcome',
      jobId: 'job-1',
      success: true,
      provider: 'africastalking',
    });
  });
});
