import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { publicSettingsSchema } from '@bom/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { PublicCache } from '../common/public-cache';
import { SettingsService } from './settings.service';

class PublicSettingsDto extends createZodDto(publicSettingsSchema) {}

@ApiTags('public')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  @PublicCache()
  @ZodResponse({ type: PublicSettingsDto })
  publicSettings() {
    return this.settings.publicSettings();
  }
}
