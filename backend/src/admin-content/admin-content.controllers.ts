import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminContentSchema,
  adminSettingsSchema,
  adminUserSchema,
  auditListSchema,
  auditQuerySchema,
  contentInputSchema,
  contentKeyParamsSchema,
  createUserSchema,
  settingInputSchema,
  settingKeyParamsSchema,
  updateUserSchema,
  userPasswordSchema,
} from '@bom/shared';
import type { Request } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import type { Actor } from '../admin-catalog/admin-products.service';
import { AdminAuth, CurrentSession, Roles } from '../auth/auth.guards';
import type { ActiveSession } from '../auth/session.service';
import { clientIp } from '../common/client-ip';
import { AdminContentService } from './admin-content.service';

class IdParamsDto extends createZodDto(z.object({ id: z.uuid() })) {}
class ContentKeyDto extends createZodDto(contentKeyParamsSchema) {}
class ContentInputDto extends createZodDto(contentInputSchema) {}
class ContentDto extends createZodDto(adminContentSchema) {}
class SettingKeyDto extends createZodDto(settingKeyParamsSchema) {}
class SettingInputDto extends createZodDto(settingInputSchema) {}
class SettingsDto extends createZodDto(adminSettingsSchema) {}
class SettingValueDto extends createZodDto(z.record(z.string(), z.unknown())) {}
class UserDto extends createZodDto(adminUserSchema) {}
class CreateUserDto extends createZodDto(createUserSchema) {}
class UpdateUserDto extends createZodDto(updateUserSchema) {}
class UserPasswordDto extends createZodDto(userPasswordSchema) {}
class AuditQueryDto extends createZodDto(auditQuerySchema) {}
class AuditListDto extends createZodDto(auditListSchema) {}
class RevokedDto extends createZodDto(z.object({ revoked: z.number().int() })) {}

const actor = (session: ActiveSession, request: Request): Actor => ({
  userId: session.user.id,
  ip: clientIp(request),
});

@ApiTags('admin')
@AdminAuth()
@Controller('admin')
export class AdminContentController {
  constructor(private readonly service: AdminContentService) {}

  @Get('content/:key')
  @ZodResponse({ type: ContentDto })
  content(@Param() params: ContentKeyDto) {
    return this.service.getContent(params.key);
  }

  @Put('content/:key')
  @ZodResponse({ type: ContentDto })
  putContent(
    @Param() params: ContentKeyDto,
    @Body() body: ContentInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.service.putContent(params.key, body.data, actor(s, r));
  }

  @Get('settings')
  @ZodResponse({ type: SettingsDto })
  settings(@CurrentSession() s: ActiveSession) {
    return this.service.getSettings(s.user.role);
  }

  @Put('settings/:key')
  @ZodResponse({ type: SettingValueDto })
  putSetting(
    @Param() params: SettingKeyDto,
    @Body() body: SettingInputDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.service.putSetting(params.key, body.value, { ...actor(s, r), role: s.user.role });
  }

  @Get('users')
  @Roles('owner')
  @ZodResponse({ type: [UserDto] })
  users() {
    return this.service.listUsers();
  }

  @Post('users')
  @Roles('owner')
  @ZodResponse({ status: 201, type: [UserDto] })
  createUser(@Body() body: CreateUserDto, @CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.service.createUser(body, actor(s, r));
  }

  @Put('users/:id')
  @Roles('owner')
  @ZodResponse({ type: [UserDto] })
  updateUser(
    @Param() params: IdParamsDto,
    @Body() body: UpdateUserDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    return this.service.updateUser(params.id, body, actor(s, r));
  }

  @Post('users/:id/password')
  @Roles('owner')
  @HttpCode(204)
  async setPassword(
    @Param() params: IdParamsDto,
    @Body() body: UserPasswordDto,
    @CurrentSession() s: ActiveSession,
    @Req() r: Request,
  ) {
    await this.service.setPassword(params.id, body.password, actor(s, r));
  }

  @Post('sessions/revoke-all')
  @Roles('owner')
  @HttpCode(200)
  @ZodResponse({ type: RevokedDto })
  revokeAll(@CurrentSession() s: ActiveSession, @Req() r: Request) {
    return this.service.revokeOtherSessions(s.id, actor(s, r));
  }

  @Get('audit')
  @Roles('owner')
  @ZodResponse({ type: AuditListDto })
  audit(@Query() query: AuditQueryDto) {
    return this.service.auditLog(query);
  }
}
