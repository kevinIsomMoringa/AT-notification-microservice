import type { Express } from 'express';
import { vi } from 'vitest';
import { applyTestEnv } from './test-env';

export async function createTestApp(overrides: Record<string, string> = {}) {
  vi.resetModules();
  const env = applyTestEnv(overrides);
  const { createApp } = await import('../../src/app');
  const app = createApp();

  return { app: app as Express, ...env };
}
