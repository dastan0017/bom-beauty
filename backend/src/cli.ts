import 'reflect-metadata';
import { parseEnv } from './config/env';
import { loadDevEnv } from './config/load-env';

// Admin CLI: `pnpm --filter @bom/backend cli <command>`. Commands are implemented with the auth module (M1).
const COMMANDS = ['create-admin', 'reset-password'] as const;

function main(): void {
  loadDevEnv();
  parseEnv(process.env);
  const command = process.argv[2];
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    console.error(`Usage: cli <${COMMANDS.join(' | ')}>`);
    process.exitCode = 1;
    return;
  }
  console.error(`"${command}" is not available yet (M1).`);
  process.exitCode = 1;
}

main();
