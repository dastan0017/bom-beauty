import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env';

/** Structured logs; personal data and secrets are redacted (CLAUDE.md, backend rules). */
export function loggerModule(env: Env) {
  return PinoLoggerModule.forRoot({
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req: IncomingMessage) => {
        const header = req.headers['x-request-id'];
        return typeof header === 'string' && header ? header : randomUUID();
      },
      // One compact line per request: method, path, status and timing (no headers or bodies).
      serializers: {
        req: (req: { id?: unknown; method?: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req: IncomingMessage) => req.url === '/health' || req.url === '/health/ready' },
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
          '*.phone',
          '*.name',
          '*.address',
          '*.password',
        ],
        censor: '[redacted]',
      },
      transport:
        env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
    },
  });
}
