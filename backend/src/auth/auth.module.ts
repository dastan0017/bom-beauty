import { Global, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { CsrfGuard, RolesGuard, SessionGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, SessionGuard, CsrfGuard, RolesGuard],
  exports: [SessionService, SessionGuard, CsrfGuard, RolesGuard],
})
export class AuthModule {}
