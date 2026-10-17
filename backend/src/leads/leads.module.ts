import { Module } from '@nestjs/common';
import { TurnstileService } from '../common/turnstile.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({ controllers: [LeadsController], providers: [LeadsService, TurnstileService] })
export class LeadsModule {}
