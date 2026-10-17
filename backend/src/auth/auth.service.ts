import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AuthSession } from '@bom/shared';
import type Redis from 'ioredis';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { UsersService } from '../users/users.service';
import { SessionService } from './session.service';

const MAX_FAILURES = 10;
const LOCK_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  /** Verifying against a real hash when the email is unknown keeps response times equal. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async login(input: {
    email: string;
    password: string;
    remember: boolean;
    ip: string;
    userAgent?: string;
  }): Promise<AuthSession & { token: string }> {
    const failKey = `login:fail:${input.email}`;
    const failures = Number(await this.redis.get(failKey));
    if (failures >= MAX_FAILURES) {
      throw new ApiException(
        'rate_limited',
        HttpStatus.TOO_MANY_REQUESTS,
        'Слишком много попыток, попробуйте позже',
      );
    }

    const user = await this.users.findByEmail(input.email);
    this.dummyHash ??= this.users.hashPassword('not-a-real-password');
    const valid = await this.users
      .verifyPassword(user?.passwordHash ?? (await this.dummyHash), input.password)
      .catch(() => false);
    if (!user || !user.isActive || !valid) {
      await this.redis.multi().incr(failKey).expire(failKey, LOCK_SECONDS).exec();
      throw new ApiException('unauthenticated', HttpStatus.UNAUTHORIZED, 'Неверный email или пароль');
    }

    await this.redis.del(failKey);
    const { token, sessionId } = await this.sessions.create({
      userId: user.id,
      remember: input.remember,
      ip: input.ip,
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      entity: 'session',
      entityId: user.id,
      action: 'login',
      ip: input.ip,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      csrfToken: this.sessions.csrfToken(sessionId),
    };
  }
}
