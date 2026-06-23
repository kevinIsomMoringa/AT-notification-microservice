import { describe, expect, it } from 'vitest';
import { openApiSpec } from '../../src/openapi/spec';

describe('openApiSpec', () => {
  it('documents all public HTTP routes', () => {
    const paths = Object.keys(openApiSpec.paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/health',
        '/ready',
        '/metrics',
        '/api/v1/notifications',
        '/diagnostics',
        '/diagnostics/log',
        '/openapi.json',
      ])
    );
  });

  it('defines notification request schema with required fields', () => {
    const schema = openApiSpec.components.schemas.NotificationRequest;

    expect(schema.required).toEqual(['channel', 'to', 'message']);
    expect(schema.properties.channel.enum).toEqual(['sms', 'email', 'whatsapp']);
  });
});
