import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Bom Beauty API')
    .setDescription('Public site and admin API. Conventions: docs/API.md.')
    .setVersion('1')
    .addCookieAuth('bb_sid')
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
