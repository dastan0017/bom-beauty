import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Local runs read the repo-root .env (created by `pnpm dev`); it wins over the shell so other projects' variables
// can't leak in. Containers and CI have no such file and use their real environment.
const rootEnv = resolve(process.cwd(), '../.env');
if (existsSync(rootEnv)) {
  // NODE_ENV belongs to the tooling (`next build` must stay in production mode).
  const values = parseEnv(readFileSync(rootEnv, 'utf8'));
  delete values.NODE_ENV;
  Object.assign(process.env, values);
}
