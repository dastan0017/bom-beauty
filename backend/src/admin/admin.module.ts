import { Module } from '@nestjs/common';
import { AdminInsightsController, AdminOrdersController } from './admin.controllers';
import { AdminInsightsService } from './admin-insights.service';
import { AdminOrdersService } from './admin-orders.service';

/** Admin endpoints for orders, leads, customers and the overview (M3). */
@Module({
  controllers: [AdminOrdersController, AdminInsightsController],
  providers: [AdminOrdersService, AdminInsightsService],
})
export class AdminModule {}
