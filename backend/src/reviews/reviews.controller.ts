import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { reviewCardSchema, type ReviewCard } from '@bom/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { imageMediaSelect, toImageRef } from '../common/media-refs';
import { PublicCache } from '../common/public-cache';
import { PrismaService } from '../prisma/prisma.service';

const REVIEW_ALT = 'Отзыв клиента';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Visible screenshots in the owner's order. Demo examples disappear once a real review is visible. */
  async visible(): Promise<ReviewCard[]> {
    const rows = await this.prisma.review.findMany({
      where: { isHidden: false },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, isDemo: true, media: { select: imageMediaSelect } },
    });
    const cards = rows.flatMap((row) => {
      const image = toImageRef(row.media, REVIEW_ALT);
      return image ? [{ id: row.id, isDemo: row.isDemo, image }] : [];
    });
    const hasReal = cards.some((card) => !card.isDemo);
    return cards.filter((card) => !hasReal || !card.isDemo).map(({ id, image }) => ({ id, image }));
  }
}

class ReviewCardDto extends createZodDto(reviewCardSchema) {}

@ApiTags('public')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @PublicCache()
  @ZodResponse({ type: [ReviewCardDto] })
  list() {
    return this.reviews.visible();
  }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] })
export class ReviewsModule {}
