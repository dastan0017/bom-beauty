import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createLeadResponseSchema, createQuizLeadSchema, createWholesaleLeadSchema } from '@bom/shared';
import type { Request } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { clientIp } from '../common/client-ip';
import { LeadsService } from './leads.service';

class CreateQuizLeadDto extends createZodDto(createQuizLeadSchema) {}
class CreateWholesaleLeadDto extends createZodDto(createWholesaleLeadSchema) {}
class CreateLeadResponseDto extends createZodDto(createLeadResponseSchema) {}

const LEAD_LIMITS = { default: { limit: 10, ttl: 60_000 }, hourly: { limit: 60, ttl: 3_600_000 } };

@ApiTags('public')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post('quiz')
  @Throttle(LEAD_LIMITS)
  @ZodResponse({ status: 201, type: CreateLeadResponseDto })
  quiz(@Body() body: CreateQuizLeadDto, @Req() request: Request) {
    return this.leads.create({ kind: 'quiz', data: body }, { ip: clientIp(request) });
  }

  @Post('wholesale')
  @Throttle(LEAD_LIMITS)
  @ZodResponse({ status: 201, type: CreateLeadResponseDto })
  wholesale(@Body() body: CreateWholesaleLeadDto, @Req() request: Request) {
    return this.leads.create({ kind: 'wholesale', data: body }, { ip: clientIp(request) });
  }
}
