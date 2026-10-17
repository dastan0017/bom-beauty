import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
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

  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });
  for (const bucket of [env.S3_PUBLIC_BUCKET, env.S3_PRIVATE_BUCKET]) {
    await s3.send(new CreateBucketCommand({ Bucket: bucket })).catch(() => undefined); // already there
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, MIGRATE_DATABASE_URL: env.DATABASE_URL },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
