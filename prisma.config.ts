import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env.local automatically for all Prisma CLI commands
config({ path: '.env.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
});