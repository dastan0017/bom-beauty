import {
  applyDecorators,
  createParamDecorator,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiCookieAuth, ApiHeader } from '@nestjs/swagger';
import type { UserRole } from '@bom/shared';
import type { Request } from 'express';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { ApiException } from '../common/errors';
import { SessionService, type ActiveSession } from './session.service';

export type AuthedRequest = Request & { session?: ActiveSession };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ROLES_KEY = 'bb:roles';

/** Requires a valid admin session cookie; attaches it to the request. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const session = await this.sessions.validate(cookies?.[this.sessions.cookieName]);
    if (!session) throw new ApiException('unauthenticated', HttpStatus.UNAUTHORIZED, 'Нужно войти');
    request.session = session;
    return true;
  }
}

/** Mutations need the admin Origin and the session's CSRF token in X-CSRF-Token. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.headers.origin !== this.env.ADMIN_ORIGIN) {
      throw new ApiException('origin_mismatch', HttpStatus.FORBIDDEN, 'Запрос с чужого сайта');
    }
    const header = request.headers['x-csrf-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!request.session || !this.sessions.isValidCsrf(request.session.id, token)) {
      throw new ApiException('csrf_failed', HttpStatus.FORBIDDEN, 'Сессия устарела, обновите страницу');
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const { session } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!session || !roles.includes(session.user.role)) {
      throw new ApiException('forbidden', HttpStatus.FORBIDDEN, 'Нет доступа');
    }
    return true;
  }
}

/** Admin endpoint: session + CSRF (on mutations) + optional role restriction. */
export const AdminAuth = (...roles: UserRole[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(SessionGuard, CsrfGuard, RolesGuard),
    ApiCookieAuth(),
    ApiHeader({ name: 'X-CSRF-Token', required: false, description: 'Required on mutations' }),
  );

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ActiveSession => {
    const { session } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!session) throw new ApiException('unauthenticated', HttpStatus.UNAUTHORIZED, 'Нужно войти');
    return session;
  },
);
