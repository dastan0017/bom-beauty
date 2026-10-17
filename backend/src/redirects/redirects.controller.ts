import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { redirectSchema, type RedirectTarget } from '@bom/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RedirectsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(path: string): Promise<RedirectTarget> {
    const row = await this.prisma.redirect.findUnique({
      where: { fromPath: path },
      select: { id: true, toPath: true, statusCode: true },
    });
    if (!row) throw notFound();
    void this.prisma.redirect
      .update({ where: { id: row.id }, data: { hits: { increment: 1 } } })
      .catch(() => undefined);
    return { toPath: row.toPath, statusCode: row.statusCode };
  }
}

class RedirectDto extends createZodDto(redirectSchema) {}
class ResolveQueryDto extends createZodDto(z.object({ path: z.string().startsWith('/').max(300) })) {}

@ApiTags('public')
@Controller('redirects')
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get('resolve')
  @ZodResponse({ type: RedirectDto })
  resolve(@Query() query: ResolveQueryDto) {
    return this.redirects.resolve(query.path);
  }
}

@Module({ controllers: [RedirectsController], providers: [RedirectsService], exports: [RedirectsService] })
export class RedirectsModule {}
