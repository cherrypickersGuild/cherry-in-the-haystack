import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/basic-module/database.module';

import { WriterAgentController } from './writer-agent.controller';
import { WriterAgentService } from './writer-agent.service';
import { GraphConceptService } from './graph-concept.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WriterAgentController],
  providers: [WriterAgentService, GraphConceptService],
})
export class WriterAgentModule {}
