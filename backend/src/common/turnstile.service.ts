import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';
import { SettingsService } from '../settings/settings.service';
import { ApiException } from './errors';

const VERIFY_TIMEOUT_MS = 5_000;

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

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
      .then((response) => response.json() as Promise<{ success?: boolean }>)
      .catch((error: unknown) => {
        // Fail open when Cloudflare is slow or unreachable: rate limits and the honeypot still apply.
        this.logger.warn(`Turnstile unavailable: ${String(error)}`);
        return null;
      });
    if (result && !result.success)
      throw new ApiException('forbidden', HttpStatus.FORBIDDEN, 'Подтвердите, что вы не робот');
  }
}
