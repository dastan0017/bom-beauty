import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /** Liveness: no dependencies. Readiness (db + redis) arrives with M1. */
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
