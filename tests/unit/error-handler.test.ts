import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/error-handler';

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

describe('errorHandler', () => {
  it('returns 400 for malformed JSON bodies', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      body: '{bad json}',
    });
    const res = createMockResponse();

    errorHandler(err, {} as never, res as never, () => undefined);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid JSON body',
    });
  });

  it('returns 500 for unexpected errors', () => {
    const res = createMockResponse();

    errorHandler(new Error('boom'), {} as never, res as never, () => undefined);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Internal server error',
    });
  });
});
