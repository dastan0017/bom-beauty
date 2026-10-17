import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Bom Beauty API')
    .setDescription('Public site and admin API. Conventions: docs/API.md.')
    .setVersion('1')
    .setOpenAPIVersion('3.1.0')
    .addCookieAuth('bb_sid')
    .build();
  return promoteDefaultResponses(cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)));
}

/**
 * `@ZodResponse` without a status documents the body as the `default` response, which typed clients
 * (openapi-fetch) read as the error branch. An operation with no explicit 2xx gets it as `200` instead.
 */
export function promoteDefaultResponses(document: OpenAPIObject): OpenAPIObject {
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const responses = path[method]?.responses;
      if (!responses?.default) continue;
      if (Object.keys(responses).some((status) => status.startsWith('2'))) continue;
      responses['200'] = responses.default;
      delete responses.default;
    }
  }
  return document;
}
