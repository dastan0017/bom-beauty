import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env itself; local runs use the repo-root .env (it wins over the shell, see CLAUDE.md).
const rootEnv = resolve(__dirname, '../.env');
if (existsSync(rootEnv)) {
  const values = parseEnv(readFileSync(rootEnv, 'utf8'));
  delete values.NODE_ENV;
  Object.assign(process.env, values);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed/seed.ts',
  },
  datasource: {
    // MIGRATE_DATABASE_URL targets another database explicitly (the test setup migrates bom_test with it),
    // because the root .env intentionally overrides DATABASE_URL from the shell.
    url: process.env.MIGRATE_DATABASE_URL ?? env('DATABASE_URL'),
  },
});
