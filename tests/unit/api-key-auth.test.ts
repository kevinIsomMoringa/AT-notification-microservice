import { afterEach, describe, expect, it, vi } from 'vitest';

function createMockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
}

async function loadAuthMiddleware() {
  vi.resetModules();
  const { apiKeyAuth } = await import('../../src/middleware/api-key-auth');
  return apiKeyAuth;
}

describe('apiKeyAuth', () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.SERVICE_API_KEY;
    process.env.NODE_ENV = 'test';
  });

  it('allows requests in test mode when SERVICE_API_KEY is unset', async () => {
    process.env.SERVICE_API_KEY = '';
    process.env.NODE_ENV = 'test';

    const apiKeyAuth = await loadAuthMiddleware();
    const next = vi.fn();
    const req = { header: () => undefined } as never;
    const res = createMockResponse();

    apiKeyAuth(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('rejects missing keys when SERVICE_API_KEY is configured', async () => {
    process.env.SERVICE_API_KEY = 'secret';
    process.env.NODE_ENV = 'test';

    const apiKeyAuth = await loadAuthMiddleware();
    const next = vi.fn();
    const req = { header: () => undefined } as never;
    const res = createMockResponse();

    apiKeyAuth(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid or missing x-api-key header',
    });
  });

  it('rejects invalid keys', async () => {
    process.env.SERVICE_API_KEY = 'secret';
    process.env.NODE_ENV = 'test';

    const apiKeyAuth = await loadAuthMiddleware();
    const next = vi.fn();
    const req = { header: () => 'wrong-key' } as never;
    const res = createMockResponse();

    apiKeyAuth(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('accepts the configured key', async () => {
    process.env.SERVICE_API_KEY = 'secret';
    process.env.NODE_ENV = 'test';

    const apiKeyAuth = await loadAuthMiddleware();
    const next = vi.fn();
    const req = { header: () => 'secret' } as never;
    const res = createMockResponse();

    apiKeyAuth(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
