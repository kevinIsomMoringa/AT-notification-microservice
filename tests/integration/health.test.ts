import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { resetProviderMocks } from '../helpers/mock-providers';

describe('health and readiness endpoints', () => {
  let app: Express;

  beforeEach(async () => {
    resetProviderMocks();
    ({ app } = await createTestApp());
  });

  it('GET /health returns service status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'notification-microservice',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('GET /ready returns readiness details', async () => {
    const response = await request(app).get('/ready').expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      service: 'notification-microservice',
    });
    expect(response.body.uptime).toEqual(expect.any(Number));
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('GET /unknown returns 404', async () => {
    const response = await request(app).get('/does-not-exist').expect(404);

    expect(response.body).toEqual({
      success: false,
      error: 'Route not found: GET /does-not-exist',
    });
  });
});
