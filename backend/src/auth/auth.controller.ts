import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { authSessionSchema, loginSchema, type AuthSession } from '@bom/shared';
import type { Request, Response } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { AuditService } from '../audit/audit.service';
import { clientIp } from '../common/client-ip';
import { CsrfGuard, CurrentSession, SessionGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { SessionService, type ActiveSession } from './session.service';

class LoginDto extends createZodDto(loginSchema) {}
class AuthSessionDto extends createZodDto(authSessionSchema) {}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ZodResponse({ type: AuthSessionDto })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const userAgent = request.headers['user-agent'];
    const { token, ...session } = await this.auth.login({
      email: body.email,
      password: body.password,
      remember: body.remember,
      ip: clientIp(request),
      ...(userAgent ? { userAgent } : {}),
    });
    response.cookie(this.sessions.cookieName, token, this.sessions.cookieOptions(body.remember));
    return session;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @CurrentSession() session: ActiveSession,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.destroy(session.id);
    await this.audit.log({
      userId: session.user.id,
      entity: 'session',
      entityId: session.user.id,
      action: 'logout',
      ip: clientIp(request),
    });
    response.clearCookie(this.sessions.cookieName, {
      ...this.sessions.cookieOptions(false),
      maxAge: undefined,
    });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ZodResponse({ type: AuthSessionDto })
  me(@CurrentSession() session: ActiveSession): AuthSession {
    return { user: session.user, csrfToken: this.sessions.csrfToken(session.id) };
  }
}
