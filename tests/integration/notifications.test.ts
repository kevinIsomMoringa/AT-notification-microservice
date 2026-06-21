import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { readStoreEntries, waitForStoreOutcome } from '../helpers/store';
import { getProviderMocks, resetProviderMocks } from '../helpers/mock-providers';

describe('POST /api/v1/notifications', () => {
  let app: Express;
  let apiKey: string;
  let storePath: string;
  const providerMocks = getProviderMocks();

  beforeEach(async () => {
    resetProviderMocks();
    ({ app, apiKey, storePath } = await createTestApp());
  });

  it('queues SMS notifications and returns 202', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send({
        channel: 'sms',
        to: '+254712345678',
        message: 'Test SMS',
      })
      .expect(202);

    expect(response.body).toMatchObject({
      success: true,
      channel: 'sms',
      provider: 'queue',
      status: 'queued',
      metadata: null,
    });
    expect(response.body.externalId).toEqual(expect.any(String));
    expect(response.body.timestamp).toEqual(expect.any(String));

    const outcome = await waitForStoreOutcome(storePath, response.body.externalId);
    expect(outcome.success).toBe(true);
    expect(providerMocks.sms).toHaveBeenCalledOnce();
  });

  it('queues email notifications and returns 202', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send({
        channel: 'email',
        to: 'user@example.com',
        subject: 'Welcome',
        message: 'Test email',
      })
      .expect(202);

    expect(response.body.channel).toBe('email');
    await waitForStoreOutcome(storePath, response.body.externalId);
    expect(providerMocks.email).toHaveBeenCalledOnce();
  });

  it('queues WhatsApp notifications and returns 202', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send({
        channel: 'whatsapp',
        to: '+254712345678',
        message: 'Test WhatsApp',
      })
      .expect(202);

    expect(response.body.channel).toBe('whatsapp');
    await waitForStoreOutcome(storePath, response.body.externalId);
    expect(providerMocks.whatsapp).toHaveBeenCalledOnce();
  });

  it('echoes metadata in the response', async () => {
    const metadata = { traceId: 'trace-123', source: 'integration-test' };

    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send({
        channel: 'sms',
        to: '+254712345678',
        message: 'Metadata test',
        metadata,
      })
      .expect(202);

    expect(response.body.metadata).toEqual(metadata);
  });

  it('records request lifecycle entries in the notification store', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send({
        channel: 'sms',
        to: '+254712345678',
        message: 'Store test',
      })
      .expect(202);

    await waitForStoreOutcome(storePath, response.body.externalId);

    const entries = readStoreEntries(storePath);
    expect(entries.some((entry) => entry.recordType === 'request')).toBe(true);
    expect(entries.some((entry) => entry.recordType === 'job')).toBe(true);
    expect(entries.some((entry) => entry.recordType === 'outcome')).toBe(true);
  });

  it('returns 401 when x-api-key is missing', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .send({
        channel: 'sms',
        to: '+254712345678',
        message: 'Unauthorized',
      })
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      error: 'Invalid or missing x-api-key header',
    });
  });

  it('returns 401 when x-api-key is invalid', async () => {
    await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', 'wrong-key')
      .send({
        channel: 'sms',
        to: '+254712345678',
        message: 'Unauthorized',
      })
      .expect(401);
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send({
        channel: 'sms',
        to: '0712345678',
        message: 'Bad phone',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details.to).toEqual([
      'to must be a valid phone number in E.164 format, e.g. +254712345678',
    ]);
  });

  it('returns 400 for malformed JSON bodies', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('Content-Type', 'application/json')
      .set('x-api-key', apiKey)
      .send('{bad json')
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: 'Invalid JSON body',
    });
  });
});
