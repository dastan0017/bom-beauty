import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { SettingsService } from '../settings/settings.service';
import { ApiException } from './errors';

/** Optional Cloudflare Turnstile check for public submissions (settings.antispam.turnstileEnabled). */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async assertHuman(token: string | undefined, ip: string): Promise<void> {
    const { turnstileEnabled } = await this.settings.get('antispam');
    const secret = this.env.TURNSTILE_SECRET_KEY;
    if (!turnstileEnabled || !secret) return;
    if (!token) throw new ApiException('forbidden', HttpStatus.FORBIDDEN, 'Подтвердите, что вы не робот');

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    }).catch((error: unknown) => {
      // Fail open when Cloudflare is unreachable: rate limits still apply.
      this.logger.warn(`Turnstile unreachable: ${String(error)}`);
      return null;
    });
    if (!response) return;
    const result = (await response.json()) as { success?: boolean };
    if (!result.success)
      throw new ApiException('forbidden', HttpStatus.FORBIDDEN, 'Подтвердите, что вы не робот');
  }
}
