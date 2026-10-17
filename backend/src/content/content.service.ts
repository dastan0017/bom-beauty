import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CONTENT_SCHEMAS,
  type ContentKey,
  type ContentResponse,
  type ContentValue,
  type FileRef,
  type ImageRef,
  type VideoRef,
} from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { notFound } from '../common/errors';
import {
  fileMediaSelect,
  imageMediaSelect,
  toFileRef,
  toImageRef,
  toVideoRef,
  videoSelect,
} from '../common/media-refs';
import { productCardSelect, productOrder, toProductCard } from '../catalog/catalog.selects';
import { PrismaService } from '../prisma/prisma.service';

interface RefIds {
  images: string[];
  videos: string[];
  files: string[];
  products: string[];
}

/** Which ids each content block mentions, so the response can resolve them. */
function refIds(key: ContentKey, data: ContentValue<ContentKey>): RefIds {
  const ids: RefIds = { images: [], videos: [], files: [], products: [] };
  if (key === 'home') {
    const home = data as ContentValue<'home'>;
    ids.images.push(...home.entries.flatMap((entry) => (entry.imageMediaId ? [entry.imageMediaId] : [])));
    if (home.greetingVideoId) ids.videos.push(home.greetingVideoId);
  }
  if (key === 'wholesale') {
    const wholesale = data as ContentValue<'wholesale'>;
    if (wholesale.catalogMediaId) ids.files.push(wholesale.catalogMediaId);
    if (wholesale.videoId) ids.videos.push(wholesale.videoId);
    ids.products.push(...wholesale.featuredProductIds);
  }
  return ids;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get<K extends ContentKey>(key: K): Promise<ContentValue<K>> {
    const row = await this.prisma.contentBlock.findUnique({ where: { key }, select: { data: true } });
    if (!row) throw notFound();
    const parsed = CONTENT_SCHEMAS[key].safeParse(row.data);
    if (!parsed.success) {
      this.logger.error(`Stored content "${key}" is invalid`);
      throw notFound();
    }
    return parsed.data as ContentValue<K>;
  }

  async publicContent(key: ContentKey): Promise<ContentResponse> {
    const row = await this.prisma.contentBlock.findUnique({ where: { key }, select: { updatedAt: true } });
    if (!row) throw notFound();
    const data = await this.get(key);
    const ids = refIds(key, data);

    const [media, videos, products] = await Promise.all([
      this.prisma.media.findMany({
        where: { id: { in: [...ids.images, ...ids.files] } },
        select: { ...imageMediaSelect, ...fileMediaSelect },
      }),
      this.prisma.video.findMany({ where: { id: { in: ids.videos } }, select: videoSelect }),
      this.prisma.product.findMany({
        where: { id: { in: ids.products }, published: true },
        orderBy: productOrder,
        select: productCardSelect,
      }),
    ]);

    const images: Record<string, ImageRef> = {};
    const files: Record<string, FileRef> = {};
    for (const item of media) {
      const image = toImageRef(item, '');
      if (image) images[item.id] = image;
      const file = toFileRef(item, this.env.MEDIA_PUBLIC_URL);
      if (file) files[item.id] = file;
    }
    const videoRefs: Record<string, VideoRef> = {};
    for (const video of videos) {
      const ref = toVideoRef(video);
      if (ref) videoRefs[video.id] = ref;
    }
    // Keep the owner's order of featured products.
    const cards = products.map(toProductCard);
    const productRefs = ids.products.flatMap((id) => cards.filter((card) => card.id === id));

    return {
      key,
      data,
      refs: { images, videos: videoRefs, files, products: productRefs },
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
