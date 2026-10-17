import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { Env } from './env';

export const ENV = Symbol('ENV');

@Global()
@Module({})
export class EnvModule {
  static forRoot(env: Env): DynamicModule {
    return { module: EnvModule, providers: [{ provide: ENV, useValue: env }], exports: [ENV] };
  }
}
