import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionUser } from '@bom/shared';
import type { CookieOptions } from 'express';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { PrismaService } from '../prisma/prisma.service';

const HOUR = 60 * 60 * 1000;
const SHORT_TTL = 12 * HOUR;
const REMEMBER_TTL = 30 * 24 * HOUR;
/** Sliding expiry is refreshed at most this often, to avoid a write per request. */
const TOUCH_INTERVAL = 5 * 60 * 1000;

export interface ActiveSession {
  id: string;
  user: SessionUser;
}

/**
 * DB sessions (docs/ARCHITECTURE.md §7.4). The cookie holds 32 random bytes; the table stores only their sha256,
 * so a database leak exposes no live sessions. The CSRF token is an HMAC of the session id.
 */
@Injectable()
export class SessionService {
  readonly cookieName: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.cookieName = env.NODE_ENV === 'production' ? '__Host-bb_sid' : 'bb_sid';
  }

  cookieOptions(remember: boolean): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(remember ? { maxAge: REMEMBER_TTL } : {}),
    };
  }

  async create(input: { userId: string; remember: boolean; userAgent?: string; ip?: string }): Promise<{
    token: string;
    sessionId: string;
  }> {
    const token = randomBytes(32).toString('base64url');
    const sessionId = this.hash(token);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: input.userId,
        rememberMe: input.remember,
        expiresAt: new Date(Date.now() + (input.remember ? REMEMBER_TTL : SHORT_TTL)),
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        ip: input.ip ?? null,
      },
    });
    return { token, sessionId };
  }

  async validate(token: string | undefined): Promise<ActiveSession | null> {
    if (!token) return null;
    const id = this.hash(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        rememberMe: true,
        expiresAt: true,
        lastSeenAt: true,
        user: { select: { id: true, email: true, name: true, role: true, isActive: true } },
      },
    });
    const now = Date.now();
    if (!session || session.expiresAt.getTime() <= now || !session.user.isActive) return null;

    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL) {
      await this.prisma.session.update({
        where: { id },
        data: {
          lastSeenAt: new Date(now),
          expiresAt: new Date(now + (session.rememberMe ? REMEMBER_TTL : SHORT_TTL)),
        },
      });
    }
    const { isActive: _isActive, ...user } = session.user;
    return { id: session.id, user };
  }

  async destroy(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  csrfToken(sessionId: string): string {
    return createHmac('sha256', this.env.SESSION_SECRET).update(sessionId).digest('base64url');
  }

  isValidCsrf(sessionId: string, candidate: string | undefined): boolean {
    if (!candidate) return false;
    const expected = Buffer.from(this.csrfToken(sessionId));
    const actual = Buffer.from(candidate);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
