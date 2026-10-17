import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createOrderResponseSchema, createOrderSchema } from '@bom/shared';
import type { Request } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { clientIp } from '../common/client-ip';
import { OrdersService } from './orders.service';

class CreateOrderDto extends createZodDto(createOrderSchema) {}
class CreateOrderResponseDto extends createZodDto(createOrderResponseSchema) {}

@ApiTags('public')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 6, ttl: 60_000 }, hourly: { limit: 30, ttl: 3_600_000 } })
  @ZodResponse({ status: 201, type: CreateOrderResponseDto })
  create(@Body() body: CreateOrderDto, @Req() request: Request) {
    const userAgent = request.headers['user-agent'];
    return this.orders.create(body, { ip: clientIp(request), ...(userAgent ? { userAgent } : {}) });
  }
}
