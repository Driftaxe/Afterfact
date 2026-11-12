import { config } from 'dotenv';
config({ path: '.env.local', quiet: true, override: true });

const devUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error('Set TEST_DATABASE_URL in .env.local to the Neon test branch');
}
if (testUrl === devUrl) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
}

process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? testUrl;