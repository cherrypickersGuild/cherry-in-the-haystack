import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppUserModule } from './modules/app_user/app-user.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { PipelineUserModule } from './modules/pipeline_user/pipeline-user.module';
import { AppScheduleModule } from './modules/schedule/schedule.module';
import { PatchNotesModule } from './modules/patch_notes/patch-notes.module';
import { StatsModule } from './modules/stats/stats.module';
import { PromptTemplateModule } from './modules/prompt_template/prompt-template.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppUserModule,
    PipelineModule,
    PipelineUserModule,
    AppScheduleModule,
    PatchNotesModule,
    StatsModule,
    PromptTemplateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
