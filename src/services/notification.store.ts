import { openSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { env } from '../config/env';
import { Channel, NotificationPayload } from '../providers/notification-provider.interface';

const storeFilePath = resolve(process.cwd(), env.NOTIFICATION_STORE_PATH);

export type NotificationLogEntry = {
  recordType: 'request' | 'job' | 'outcome';
  timestamp: string;
  jobId: string;
  channel?: Channel;
  payload?: NotificationPayload;
  provider?: string;
  success?: boolean;
  status?: string;
  attempts?: number;
  error?: string;
};

export class NotificationStore {
  constructor() {
    mkdirSync(dirname(storeFilePath), { recursive: true });
    openSync(storeFilePath, 'a').close();
  }

  private async append(entry: NotificationLogEntry) {
    const payload = JSON.stringify(entry) + '\n';
    await import('fs/promises').then((fs) => fs.appendFile(storeFilePath, payload));
  }

  async recordRequest(jobId: string, channel: Channel, payload: NotificationPayload) {
    await this.append({
      recordType: 'request',
      timestamp: new Date().toISOString(),
      jobId,
      channel,
      payload,
    });
  }

  async recordJob(jobId: string, provider: string, status: string, attempts: number, error?: string) {
    await this.append({
      recordType: 'job',
      timestamp: new Date().toISOString(),
      jobId,
      provider,
      status,
      attempts,
      error,
    });
  }

  async recordOutcome(jobId: string, success: boolean, provider: string, status: string, error?: string) {
    await this.append({
      recordType: 'outcome',
      timestamp: new Date().toISOString(),
      jobId,
      provider,
      success,
      status,
      error,
    });
  }
}
