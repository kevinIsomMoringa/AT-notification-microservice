import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { waitForStoreOutcome } from '../helpers/store';
import { resetProviderMocks } from '../helpers/mock-providers';

describe('rate limiting', () => {
  let app: Express;
  let apiKey: string;
  let storePath: string;

  beforeEach(async () => {
    resetProviderMocks();
    ({ app, apiKey, storePath } = await createTestApp({
      RATE_LIMIT_MAX: '2',
      RATE_LIMIT_WINDOW_MS: '60000',
    }));
  });

  it('returns 429 after the configured request limit is exceeded', async () => {
    const payload = {
      channel: 'sms',
      to: '+254712345678',
      message: 'Rate limit test',
    };

    const first = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(202);
    const second = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(202);

    const response = await request(app)
      .post('/api/v1/notifications')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(429);

    expect(response.body).toEqual({
      success: false,
      error: 'Too many requests, please try again later.',
    });

    await waitForStoreOutcome(storePath, first.body.externalId);
    await waitForStoreOutcome(storePath, second.body.externalId);
  });
});
