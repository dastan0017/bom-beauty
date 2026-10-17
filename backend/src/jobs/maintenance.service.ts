import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Hourly and daily housekeeping (scheduled by JobsService.schedule, Asia/Bishkek). */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Uploads that were presigned but never completed. */
  async uploadsCleanup(now = new Date()): Promise<number> {
    const stale = await this.prisma.media.findMany({
      where: { status: 'pending', expiresAt: { lt: now } },
      select: { id: true, key: true },
      take: 500,
    });
    for (const media of stale) {
      if (media.key) await this.storage.delete('private', media.key).catch(() => undefined);
      await this.prisma.media.delete({ where: { id: media.id } }).catch(() => undefined);
    }
    if (stale.length) this.logger.log(`Removed ${stale.length} expired uploads`);
    return stale.length;
  }

  async sessionsCleanup(now = new Date()): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
    if (count) this.logger.log(`Removed ${count} expired sessions`);
    return count;
  }
}
