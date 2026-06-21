import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../../src/utils/with-timeout';

describe('withTimeout', () => {
  it('resolves when the wrapped promise completes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, 'timed out')).resolves.toBe('ok');
  });

  it('rejects when the wrapped promise exceeds the timeout', async () => {
    vi.useFakeTimers();

    try {
      const pending = new Promise<string>(() => undefined);
      const result = withTimeout(pending, 50, 'operation timed out');
      const assertion = expect(result).rejects.toThrow('operation timed out');

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects when the wrapped promise fails', async () => {
    await expect(withTimeout(Promise.reject(new Error('provider down')), 100, 'timed out')).rejects.toThrow(
      'provider down'
    );
  });
});
