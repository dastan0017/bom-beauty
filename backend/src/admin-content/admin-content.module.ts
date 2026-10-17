import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { UsersModule } from '../users/users.module';
import { AdminContentController } from './admin-content.controllers';
import { AdminContentService } from './admin-content.service';

/** Admin content blocks, settings, users, sessions and the audit log (M4). */
@Module({
  imports: [ContentModule, UsersModule],
  controllers: [AdminContentController],
  providers: [AdminContentService],
})
export class AdminContentModule {}
