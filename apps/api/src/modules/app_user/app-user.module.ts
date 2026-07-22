import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/basic-module/database.module';
import { AuthModule } from 'src/common/basic-module/auth.module';
import { RedisService } from 'src/common/basic-service/redis.service';
import { AppUserController } from './app-user.controller';
import { AppUserService } from './app-user.service';
import { AppUserAuthService } from './app-user-auth.service';
import { BenchKeyCleanupService } from './bench-key-cleanup.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AppUserController],
  providers: [AppUserService, AppUserAuthService, RedisService, BenchKeyCleanupService],
  exports: [AppUserService],
})
export class AppUserModule {}
