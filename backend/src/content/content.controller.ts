import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CONTENT_KEYS, contentResponseSchema, type ContentKey } from '@bom/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { PublicCache } from '../common/public-cache';
import { ContentService } from './content.service';

class ContentResponseDto extends createZodDto(contentResponseSchema) {}
class ContentParamsDto extends createZodDto(
  z.object({ key: z.enum(CONTENT_KEYS as [ContentKey, ...ContentKey[]]) }),
) {}

@ApiTags('public')
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get(':key')
  @PublicCache()
  @ZodResponse({ type: ContentResponseDto })
  get(@Param() params: ContentParamsDto) {
    return this.content.publicContent(params.key);
  }
}
