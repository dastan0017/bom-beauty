import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  customerQuerySchema,
  customerSchema,
  dashboardQuerySchema,
  dashboardSchema,
  leadListQuerySchema,
  leadListSchema,
  orderCountersSchema,
  orderDetailSchema,
  orderListQuerySchema,
  orderListSchema,
  updateOrderSchema,
} from '@bom/shared';
import type { Request, Response } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { z } from 'zod';
import { AdminAuth, CurrentSession, Roles } from '../auth/auth.guards';
import type { ActiveSession } from '../auth/session.service';
import { clientIp } from '../common/client-ip';
import { AdminInsightsService } from './admin-insights.service';
import { AdminOrdersService } from './admin-orders.service';

class OrderListQueryDto extends createZodDto(orderListQuerySchema) {}
class OrderExportQueryDto extends createZodDto(orderListQuerySchema.omit({ cursor: true, limit: true })) {}
class OrderListDto extends createZodDto(orderListSchema) {}
class OrderCountersDto extends createZodDto(orderCountersSchema) {}
class OrderDetailDto extends createZodDto(orderDetailSchema) {}
class UpdateOrderDto extends createZodDto(updateOrderSchema) {}
class IdParamsDto extends createZodDto(z.object({ id: z.uuid() })) {}
class LeadListQueryDto extends createZodDto(leadListQuerySchema) {}
class LeadListDto extends createZodDto(leadListSchema) {}
class CustomerQueryDto extends createZodDto(customerQuerySchema) {}
class CustomerDto extends createZodDto(customerSchema) {}
class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}
class DashboardDto extends createZodDto(dashboardSchema) {}

const actor = (session: ActiveSession, request: Request) => ({
  userId: session.user.id,
  ip: clientIp(request),
});

@ApiTags('admin')
@AdminAuth()
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @ZodResponse({ type: OrderListDto })
  list(@Query() query: OrderListQueryDto) {
    return this.orders.list(query);
  }

  /** Polled every 15 s for the nav badge. */
  @Get('counters')
  @ZodResponse({ type: OrderCountersDto })
  counters() {
    return this.orders.counters();
  }

  @Get('export.csv')
  @Roles('owner')
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async exportCsv(@Query() query: OrderExportQueryDto, @Res({ passthrough: true }) response: Response) {
    const date = new Date().toISOString().slice(0, 10);
    response.setHeader('Content-Disposition', `attachment; filename="bom-orders-${date}.csv"`);
    return this.orders.exportCsv(query);
  }

  @Get(':id')
  @ZodResponse({ type: OrderDetailDto })
  detail(@Param() params: IdParamsDto) {
    return this.orders.detail(params.id);
  }

  @Patch(':id')
  @ZodResponse({ type: OrderDetailDto })
  update(
    @Param() params: IdParamsDto,
    @Body() body: UpdateOrderDto,
    @CurrentSession() session: ActiveSession,
    @Req() request: Request,
  ) {
    return this.orders.update(params.id, body, actor(session, request));
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(204)
  async remove(
    @Param() params: IdParamsDto,
    @CurrentSession() session: ActiveSession,
    @Req() request: Request,
  ) {
    await this.orders.remove(params.id, actor(session, request));
  }
}

@ApiTags('admin')
@AdminAuth()
@Controller('admin')
export class AdminInsightsController {
  constructor(private readonly insights: AdminInsightsService) {}

  @Get('leads')
  @ZodResponse({ type: LeadListDto })
  leads(@Query() query: LeadListQueryDto) {
    return this.insights.leads(query);
  }

  @Delete('leads/:id')
  @Roles('owner')
  @HttpCode(204)
  async removeLead(
    @Param() params: IdParamsDto,
    @CurrentSession() session: ActiveSession,
    @Req() request: Request,
  ) {
    await this.insights.removeLead(params.id, actor(session, request));
  }

  @Get('customers')
  @ZodResponse({ type: [CustomerDto] })
  customers(@Query() query: CustomerQueryDto) {
    return this.insights.customers(query.q);
  }

  @Get('dashboard')
  @ZodResponse({ type: DashboardDto })
  dashboard(@Query() query: DashboardQueryDto) {
    return this.insights.dashboard(query.period);
  }
}
