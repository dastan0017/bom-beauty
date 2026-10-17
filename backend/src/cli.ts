import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { USER_ROLES, type UserRole } from '@bom/shared';
import { parseEnv, type Env } from './config/env';
import { EnvModule } from './config/env.module';
import { loadDevEnv } from './config/load-env';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';

// Admin CLI: `pnpm --filter @bom/backend cli <command> [--email ..] [--name ..] [--password ..] [--role owner|manager]`.
// Without --password a random one is generated and printed once.

const USAGE = `Usage:
  cli create-admin --email owner@example.com --name "Нурайым" [--password ...] [--role owner|manager]
  cli reset-password --email owner@example.com [--password ...]`;

@Module({})
class CliModule {
  static forRoot(env: Env) {
    return { module: CliModule, imports: [EnvModule.forRoot(env), PrismaModule, UsersModule] };
  }
}

async function main(): Promise<void> {
  loadDevEnv();
  const env = parseEnv(process.env);
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', default: 'owner' },
    },
  });
  const command = positionals[0];
  const email = values.email?.trim().toLowerCase();
  if (!email || (command !== 'create-admin' && command !== 'reset-password')) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(CliModule.forRoot(env), { logger: ['error'] });
  const users = app.get(UsersService);
  const generated = !values.password;
  const password = values.password ?? randomBytes(12).toString('base64url');

  try {
    if (command === 'create-admin') {
      const role = values.role as UserRole;
      if (!USER_ROLES.includes(role)) throw new Error(`Unknown role "${values.role}"`);
      if (await users.findByEmail(email)) throw new Error(`User ${email} already exists`);
      await users.create({ email, name: values.name ?? email, password, role });
      console.log(`Created ${role} ${email}`);
    } else {
      const user = await users.findByEmail(email);
      if (!user) throw new Error(`No user ${email}`);
      await users.setPassword(user.id, password);
      console.log(`Password updated for ${email}; all sessions signed out`);
    }
    if (generated) console.log(`Password: ${password}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
