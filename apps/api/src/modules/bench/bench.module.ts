import { Module } from '@nestjs/common'

import { AuthModule } from '../../common/basic-module/auth.module'
import { AppUserModule } from '../app_user/app-user.module'
import { BenchController } from './bench.controller'
import { BenchService } from './bench.service'

@Module({
  // AuthModule: AuthGuard('jwt') 전략 제공 / AppUserModule: 회원 키 로드(AppUserService)
  imports: [AuthModule, AppUserModule],
  controllers: [BenchController],
  providers: [BenchService],
})
export class BenchModule {}
