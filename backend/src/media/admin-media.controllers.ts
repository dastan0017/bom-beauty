import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminMediaSchema,
  adminVideoSchema,
  createVideoResponseSchema,
  createVideoSchema,
  notificationTestResultSchema,
  presignMediaResponseSchema,
  presignMediaSchema,
} from '@bom/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AdminAuth, CurrentSession, Roles } from '../auth/auth.guards';
import type { ActiveSession } from '../auth/session.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VideosService } from '../videos/videos.service';
import { MediaService } from './media.service';

class IdParamsDto extends createZodDto(z.object({ id: z.uuid() })) {}
class PresignDto extends createZodDto(presignMediaSchema) {}
class PresignResponseDto extends createZodDto(presignMediaResponseSchema) {}
class MediaDto extends createZodDto(adminMediaSchema) {}
class CreateVideoDto extends createZodDto(createVideoSchema) {}
class CreateVideoResponseDto extends createZodDto(createVideoResponseSchema) {}
class VideoDto extends createZodDto(adminVideoSchema) {}
class NotificationTestDto extends createZodDto(notificationTestResultSchema) {}
class BunnyWebhookDto extends createZodDto(
  z.object({
    VideoGuid: z.string().max(100).optional(),
    VideoLibraryId: z.coerce.string().optional(),
    Status: z.number().optional(),
  }),
) {}

@ApiTags('admin')
@AdminAuth()
@Controller('admin')
export class AdminMediaController {
  constructor(
    private readonly media: MediaService,
    private readonly videos: VideosService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post('media/presign')
  @HttpCode(200)
  @ZodResponse({ type: PresignResponseDto })
  presign(@Body() body: PresignDto, @CurrentSession() session: ActiveSession) {
    return this.media.presign(body, session.user.id);
  }

  @Post('media/:id/complete')
  @HttpCode(200)
  @ZodResponse({ type: MediaDto })
  complete(@Param() params: IdParamsDto) {
    return this.media.complete(params.id);
  }

  @Get('media/:id')
  @ZodResponse({ type: MediaDto })
  getMedia(@Param() params: IdParamsDto) {
    return this.media.get(params.id);
  }

  @Post('videos')
  @ZodResponse({ status: 201, type: CreateVideoResponseDto })
  createVideo(@Body() body: CreateVideoDto) {
    return this.videos.create(body);
  }

  @Get('videos/:id')
  @ZodResponse({ type: VideoDto })
  getVideo(@Param() params: IdParamsDto) {
    return this.videos.get(params.id);
  }

  @Delete('videos/:id')
  @HttpCode(204)
  async deleteVideo(@Param() params: IdParamsDto) {
    await this.videos.remove(params.id);
  }

  @Post('settings/notifications/test')
  @Roles('owner')
  @HttpCode(200)
  @ZodResponse({ type: NotificationTestDto })
  testNotifications() {
    return this.notifications.test();
  }
}

/** Bunny Stream webhook: unsigned, so it only triggers a status fetch (docs/ARCHITECTURE.md §7.6). */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly videos: VideosService) {}

  @Post('bunny')
  @HttpCode(204)
  async bunny(@Body() body: BunnyWebhookDto) {
    await this.videos.webhook(body.VideoGuid);
  }
}
