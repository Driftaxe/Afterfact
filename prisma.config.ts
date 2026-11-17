import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env and .env.local automatically for all Prisma CLI commands
config({ path: '.env' });
config({ path: '.env.local', override: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
});