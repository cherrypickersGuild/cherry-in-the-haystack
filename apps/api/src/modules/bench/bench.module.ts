import { Module } from '@nestjs/common'

import { BenchController } from './bench.controller'
import { BenchService } from './bench.service'

@Module({
  controllers: [BenchController],
  providers: [BenchService],
})
export class BenchModule {}
