import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    restoreMocks: true,
    clearMocks: true,
    fileParallelism: false,
    globalTeardown: './tests/teardown.ts',
  },
});
