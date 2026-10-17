import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { clientIp } from './client-ip';

const ADMIN_PATH = /^\/v1\/admin(\/|$)/;
/** Admin screens poll and upload in bursts (30 review screenshots ≈ 150 calls), docs/API.md §3. */
const ADMIN_LIMIT_PER_MINUTE = 600;
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

/**
 * Rate limits (docs/API.md §3): per real client IP (Express resolves it through TRUST_PROXY hops), admin calls per
 * session. The site's own server-side fetches all come from one internal address, so they carry the shared web↔API
 * secret and are not limited; visitors are limited where they reach the API directly.
 */
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  private readonly internalSecret: Buffer;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    @Inject(ENV) env: Env,
  ) {
    super(options, storage, reflector);
    this.internalSecret = Buffer.from(env.REVALIDATE_SECRET);
  }

  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequestResponse(context).req as Request;
    const header = request.headers[INTERNAL_SECRET_HEADER];
    if (typeof header !== 'string') return Promise.resolve(false);
    const given = Buffer.from(header);
    return Promise.resolve(
      given.length === this.internalSecret.length && timingSafeEqual(given, this.internalSecret),
    );
  }

  protected override getTracker(raw: Record<string, unknown>): Promise<string> {
    const request = raw as unknown as Request;
    const session = sessionToken(request);
    if (session && ADMIN_PATH.test(request.path)) {
      return Promise.resolve(`session:${createHash('sha256').update(session).digest('hex').slice(0, 32)}`);
    }
    return Promise.resolve(clientIp(request));
  }

  protected override handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const request = this.getRequestResponse(props.context).req as Request;
    if (props.throttler.name === 'default' && ADMIN_PATH.test(request.path)) {
      return super.handleRequest({ ...props, limit: ADMIN_LIMIT_PER_MINUTE });
    }
    return super.handleRequest(props);
  }
}

function sessionToken(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  return cookies?.['__Host-bb_sid'] ?? cookies?.bb_sid;
}
