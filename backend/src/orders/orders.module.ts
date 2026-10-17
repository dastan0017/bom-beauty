import { Module } from '@nestjs/common';
import { TurnstileService } from '../common/turnstile.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({ controllers: [OrdersController], providers: [OrdersService, TurnstileService] })
export class OrdersModule {}
