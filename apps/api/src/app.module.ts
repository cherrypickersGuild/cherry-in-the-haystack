import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppUserModule } from './modules/app_user/app-user.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { PipelineUserModule } from './modules/pipeline_user/pipeline-user.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AppUserModule, PipelineModule, PipelineUserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
