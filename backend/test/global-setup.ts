import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { testEnv } from './env';

/** Creates the test database if needed and applies migrations once per run. */
export default async function setup(): Promise<void> {
  const env = testEnv();
  const target = new URL(env.DATABASE_URL);
  const database = target.pathname.slice(1);
  const admin = new URL(env.DATABASE_URL);
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, MIGRATE_DATABASE_URL: env.DATABASE_URL },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
