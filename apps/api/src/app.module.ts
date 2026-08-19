import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppUserModule } from './modules/app_user/app-user.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { PipelineUserModule } from './modules/pipeline_user/pipeline-user.module';
import { AppScheduleModule } from './modules/schedule/schedule.module';
import { PatchNotesModule } from './modules/patch_notes/patch-notes.module';
import { StatsModule } from './modules/stats/stats.module';
import { PromptTemplateModule } from './modules/prompt_template/prompt-template.module';
import { AgentCommModule } from './modules/agent_comm/agent-comm.module';
import { KaasModule } from './modules/kaas/kaas.module';
import { WriterAgentModule } from './modules/writer_agent/writer-agent.module';
import { BenchModule } from './modules/bench/bench.module';
import { FrameworksLandscapeModule } from './modules/frameworks_landscape/frameworks-landscape.module';
import { ConceptModule } from './modules/concept/concept.module';

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
    AgentCommModule,
    KaasModule,
    WriterAgentModule,
    BenchModule,
    FrameworksLandscapeModule,
    ConceptModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
