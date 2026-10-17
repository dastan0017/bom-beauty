import { createHash } from 'node:crypto';
import type { Request } from 'express';

/** Client IP as resolved by Express with `trust proxy` (env TRUST_PROXY). */
export function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

/** IPs are only stored as salted hashes (abuse analysis without keeping raw addresses). */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
