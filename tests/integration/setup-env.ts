import { config } from 'dotenv';
config({ path: '.env.local', quiet: true, override: true });

const devUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

// Gate integration tests so they do not hang on network timeouts in offline or sandboxed environments
export const hasTestDb = Boolean(
  testUrl && (process.env.ENABLE_INTEGRATION_TESTS === 'true' || process.env.CI === 'true')
);

if (testUrl) {
  if (testUrl === devUrl) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  }
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? testUrl;
} else {
  console.warn('TEST_DATABASE_URL not set: DB integration tests will be skipped');
}