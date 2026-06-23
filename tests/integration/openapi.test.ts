import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { resetProviderMocks } from '../helpers/mock-providers';
import { openApiSpec } from '../../src/openapi/spec';

describe('OpenAPI documentation', () => {
  let app: Express;

  beforeEach(async () => {
    resetProviderMocks();
    ({ app } = await createTestApp());
  });

  it('GET /openapi.json returns the OpenAPI spec', async () => {
    const response = await request(app).get('/openapi.json').expect(200);

    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info.title).toBe(openApiSpec.info.title);
    expect(response.body.paths['/api/v1/notifications']).toBeDefined();
    expect(response.body.paths['/health']).toBeDefined();
    expect(response.body.components.securitySchemes.ApiKeyAuth).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key',
    });
  });

  it('GET /docs serves Swagger UI HTML', async () => {
    const response = await request(app).get('/docs/').expect(200);

    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('Notification API Docs');
  });
});
