import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FOREIGN_CURRENCY_CODES,
  SETTING_DEFAULTS,
  SETTING_SCHEMAS,
  type PublicSettings,
  type SettingKey,
  type SettingValue,
} from '@bom/shared';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { imageMediaSelect, toImageRef } from '../common/media-refs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Stored value merged over the defaults; an invalid stored value falls back to the defaults. */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const row = await this.prisma.setting.findUnique({ where: { key }, select: { value: true } });
    const defaults = SETTING_DEFAULTS[key];
    if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value))
      return defaults;
    const parsed = SETTING_SCHEMAS[key].safeParse({ ...defaults, ...row.value });
    if (!parsed.success) {
      this.logger.warn(`Stored setting "${key}" is invalid; using defaults`);
      return defaults;
    }
    return parsed.data as SettingValue<K>;
  }

  async publicSettings(): Promise<PublicSettings> {
    const [shop, appearance, currencies, seo, analytics, antispam] = await Promise.all([
      this.get('shop'),
      this.get('appearance'),
      this.get('currencies'),
      this.get('seo'),
      this.get('analytics'),
      this.get('antispam'),
    ]);
    const ogMedia = seo.ogMediaId
      ? await this.prisma.media.findUnique({ where: { id: seo.ogMediaId }, select: imageMediaSelect })
      : null;
    const { ogMediaId: _ogMediaId, ...seoText } = seo;

    return {
      shop,
      appearance,
      currencies: [
        { code: 'KGS', rate: 1 },
        ...FOREIGN_CURRENCY_CODES.filter((code) => currencies[code].enabled).map((code) => ({
          code,
          rate: currencies[code].rate,
        })),
      ],
      seo: { ...seoText, ogImage: toImageRef(ogMedia, seo.defaultTitle) },
      analytics: {
        umamiWebsiteId: analytics.umamiWebsiteId,
        metaPixelId: analytics.metaPixelEnabled ? analytics.metaPixelId : null,
      },
      turnstileSiteKey: antispam.turnstileEnabled ? (this.env.TURNSTILE_SITE_KEY ?? null) : null,
    };
  }
}
