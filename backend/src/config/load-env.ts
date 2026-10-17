import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Loads the repo-root .env when present (created by `pnpm dev` from infra/.env.example). Its values win over the
 * shell so variables exported for other projects (a global DATABASE_URL, for example) can't leak in.
 * Containers and CI have no such file and use their real environment.
 */
export function loadDevEnv(): void {
  const file = resolve(__dirname, '../../../.env');
  if (!existsSync(file)) return;
  const values = parseEnv(readFileSync(file, 'utf8'));
  delete values.NODE_ENV; // set by the tooling, never by .env
  Object.assign(process.env, values);
}
