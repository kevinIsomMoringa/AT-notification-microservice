import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { resetProviderMocks } from '../helpers/mock-providers';

describe('metrics endpoint', () => {
  let app: Express;

  beforeEach(async () => {
    resetProviderMocks();
    ({ app } = await createTestApp());
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    await request(app).get('/health').expect(200);

    const response = await request(app).get('/metrics').expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('notification_requests_total');
    expect(response.text).toContain('notification_request_duration_seconds');
    expect(response.text).toContain('notification_provider_success_total');
    expect(response.text).toContain('notification_provider_failure_total');
  });
});
