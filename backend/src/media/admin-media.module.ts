import { Module } from '@nestjs/common';
import { VideosService } from '../videos/videos.service';
import { AdminMediaController, WebhooksController } from './admin-media.controllers';
import { MediaService } from './media.service';

/** Uploads, videos, the Bunny webhook and the notification test (M5). */
@Module({
  controllers: [AdminMediaController, WebhooksController],
  providers: [MediaService, VideosService],
})
export class AdminMediaModule {}
