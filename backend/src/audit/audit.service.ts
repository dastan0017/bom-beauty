import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId: string | null;
  entity: string;
  entityId: string;
  action: string;
  diff?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Who changed what. Every admin mutation writes one entry (CLAUDE.md, backend rules). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        diff: entry.diff ?? {},
        ip: entry.ip ?? null,
      },
    });
  }
}
