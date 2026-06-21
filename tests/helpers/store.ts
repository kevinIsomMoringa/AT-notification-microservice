import { readFileSync } from 'fs';
import { NotificationLogEntry } from '../../src/services/notification.store';

export function readStoreEntries(storePath: string): NotificationLogEntry[] {
  try {
    const content = readFileSync(storePath, 'utf8').trim();
    if (!content) {
      return [];
    }

    return content.split('\n').map((line) => JSON.parse(line) as NotificationLogEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function waitForStoreOutcome(
  storePath: string,
  jobId: string,
  timeoutMs = 5000
): Promise<NotificationLogEntry> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const outcome = readStoreEntries(storePath).find(
      (entry) => entry.recordType === 'outcome' && entry.jobId === jobId
    );

    if (outcome) {
      return outcome;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for outcome of job ${jobId}`);
}

export async function waitForStoreJob(
  storePath: string,
  jobId: string,
  status: string,
  timeoutMs = 5000
): Promise<NotificationLogEntry> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const job = readStoreEntries(storePath).find(
      (entry) => entry.recordType === 'job' && entry.jobId === jobId && entry.status === status
    );

    if (job) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for job ${jobId} with status ${status}`);
}
