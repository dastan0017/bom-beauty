// Creates the root .env from infra/.env.example on first run so `pnpm dev` works out of the box.
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = `${root}.env`;

if (!existsSync(target)) {
  copyFileSync(`${root}infra/.env.example`, target);
  console.log('Created .env from infra/.env.example');
}
