import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const managedTempDirs = new Set<string>();

export function applyTestEnv(overrides: Record<string, string> = {}) {
  const storeDir = mkdtempSync(join(tmpdir(), 'notification-test-'));
  managedTempDirs.add(storeDir);

  const defaults: Record<string, string> = {
    NODE_ENV: 'test',
    SERVICE_API_KEY: 'test-api-key',
    NOTIFICATION_STORE_PATH: join(storeDir, 'notifications.log'),
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: '1000',
    CORS_ORIGINS: '',
    PROVIDER_TIMEOUT_MS: '5000',
    AT_USERNAME: 'sandbox',
    AT_API_KEY: 'test-at-key',
    AT_SENDER_ID: '',
    SMTP_HOST: 'smtp.test.local',
    SMTP_PORT: '587',
    SMTP_USER: 'user@test.local',
    SMTP_PASS: 'pass',
    SMTP_FROM: 'Notifications <test@test.local>',
    TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_WHATSAPP_NUMBER: '+14155238886',
    ...overrides,
  };

  for (const [key, value] of Object.entries(defaults)) {
    process.env[key] = value;
  }

  return {
    storeDir,
    storePath: defaults.NOTIFICATION_STORE_PATH,
    apiKey: defaults.SERVICE_API_KEY,
  };
}

export function cleanupTestEnv() {
  for (const dir of managedTempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  managedTempDirs.clear();
}
