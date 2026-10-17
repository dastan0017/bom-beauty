import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from './client-ip';

/** Rate limits per real client IP (Express resolves it through TRUST_PROXY hops). */
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientIp(request as unknown as Request));
  }
}
