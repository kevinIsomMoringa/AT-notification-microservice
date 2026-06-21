import { vi } from 'vitest';
import type {
  Channel,
  NotificationPayload,
  NotificationResult,
} from '../../src/providers/notification-provider.interface';

const { providerMocks } = vi.hoisted(() => ({
  providerMocks: {
    sms: vi.fn<(payload: NotificationPayload) => Promise<NotificationResult>>(),
    email: vi.fn<(payload: NotificationPayload) => Promise<NotificationResult>>(),
    whatsapp: vi.fn<(payload: NotificationPayload) => Promise<NotificationResult>>(),
  },
}));

function successResult(channel: Channel, provider: string, externalId: string): NotificationResult {
  return {
    success: true,
    channel,
    provider,
    externalId,
    status: 'Success',
  };
}

export function getProviderMocks() {
  return providerMocks;
}

export function mockProviderSuccess(channel: Channel, provider: string, externalId: string) {
  const result = successResult(channel, provider, externalId);

  if (channel === 'sms') {
    providerMocks.sms.mockResolvedValue(result);
  } else if (channel === 'email') {
    providerMocks.email.mockResolvedValue(result);
  } else {
    providerMocks.whatsapp.mockResolvedValue(result);
  }
}

export function mockProviderFailure(channel: Channel, provider: string, status: string) {
  const result: NotificationResult = {
    success: false,
    channel,
    provider,
    status,
  };

  if (channel === 'sms') {
    providerMocks.sms.mockResolvedValue(result);
  } else if (channel === 'email') {
    providerMocks.email.mockResolvedValue(result);
  } else {
    providerMocks.whatsapp.mockResolvedValue(result);
  }
}

export function resetProviderMocks() {
  providerMocks.sms.mockReset();
  providerMocks.email.mockReset();
  providerMocks.whatsapp.mockReset();

  mockProviderSuccess('sms', 'africastalking', 'ATXid_test');
  mockProviderSuccess('email', 'smtp', 'smtp-test-id');
  mockProviderSuccess('whatsapp', 'twilio', 'SMtest');
}

vi.mock('../../src/providers/sms.provider', () => ({
  SmsProvider: class MockSmsProvider {
    readonly channel = 'sms' as const;
    send = providerMocks.sms;
  },
}));

vi.mock('../../src/providers/email.provider', () => ({
  EmailProvider: class MockEmailProvider {
    readonly channel = 'email' as const;
    send = providerMocks.email;
  },
}));

vi.mock('../../src/providers/whatsapp.provider', () => ({
  WhatsappProvider: class MockWhatsappProvider {
    readonly channel = 'whatsapp' as const;
    send = providerMocks.whatsapp;
  },
}));
