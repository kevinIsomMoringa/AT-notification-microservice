import { describe, expect, it } from 'vitest';
import { notificationSchema } from '../../src/validators/notification.validator';

describe('notificationSchema', () => {
  it('accepts valid SMS payloads', () => {
    const result = notificationSchema.safeParse({
      channel: 'sms',
      to: '+254712345678',
      message: 'Hello',
    });

    expect(result.success).toBe(true);
  });

  it('accepts valid email payloads with subject and metadata', () => {
    const result = notificationSchema.safeParse({
      channel: 'email',
      to: 'user@example.com',
      subject: 'Welcome',
      message: 'Thanks for signing up',
      metadata: { userId: '123' },
    });

    expect(result.success).toBe(true);
  });

  it('accepts valid WhatsApp payloads', () => {
    const result = notificationSchema.safeParse({
      channel: 'whatsapp',
      to: '+14155550123',
      message: 'Hello',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown channels', () => {
    const result = notificationSchema.safeParse({
      channel: 'push',
      to: '+254712345678',
      message: 'Hello',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid phone numbers for SMS', () => {
    const result = notificationSchema.safeParse({
      channel: 'sms',
      to: '0712345678',
      message: 'Hello',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.to).toContain(
        'to must be a valid phone number in E.164 format, e.g. +254712345678'
      );
    }
  });

  it('rejects invalid email addresses', () => {
    const result = notificationSchema.safeParse({
      channel: 'email',
      to: 'not-an-email',
      message: 'Hello',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.to).toContain(
        'to must be a valid email address when channel is "email"'
      );
    }
  });

  it('rejects empty messages', () => {
    const result = notificationSchema.safeParse({
      channel: 'sms',
      to: '+254712345678',
      message: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects messages longer than 2000 characters', () => {
    const result = notificationSchema.safeParse({
      channel: 'sms',
      to: '+254712345678',
      message: 'x'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects subjects longer than 255 characters', () => {
    const result = notificationSchema.safeParse({
      channel: 'email',
      to: 'user@example.com',
      subject: 'x'.repeat(256),
      message: 'Hello',
    });

    expect(result.success).toBe(false);
  });
});
