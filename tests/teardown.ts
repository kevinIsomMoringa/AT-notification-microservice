import { cleanupTestEnv } from './helpers/test-env';

export default async function globalTeardown() {
  cleanupTestEnv();
}
