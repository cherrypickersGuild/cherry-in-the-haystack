import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/basic-module/database.module';

import { KaasAgentController } from './kaas-agent.controller';
import { KaasCatalogController } from './kaas-catalog.controller';
import { KaasQueryController } from './kaas-query.controller';
import { KaasCreditController } from './kaas-credit.controller';
import { KaasCompareController } from './kaas-compare.controller';
import { KaasAdminController } from './kaas-admin.controller';
import { KaasMcpController } from './kaas-mcp.controller';
import { KaasCuratorRewardController } from './kaas-curator-reward.controller';
import { KaasWsGateway } from './kaas-ws.gateway';

import { KaasAgentService } from './kaas-agent.service';
import { KaasKnowledgeService } from './kaas-knowledge.service';
import { KaasCreditService } from './kaas-credit.service';
import { KaasProvenanceService } from './kaas-provenance.service';
import { KaasCuratorRewardService } from './kaas-curator-reward.service';
import { KaasAgentDaemonService } from './kaas-agent-daemon.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    KaasAgentController,
    KaasCatalogController,
    KaasQueryController,
    KaasCreditController,
    KaasCompareController,
    KaasAdminController,
    KaasMcpController,
    KaasCuratorRewardController,
  ],
  providers: [
    KaasAgentService,
    KaasKnowledgeService,
    KaasCreditService,
    KaasProvenanceService,
    KaasCuratorRewardService,
    KaasWsGateway,
    KaasAgentDaemonService,
  ],
  exports: [
    KaasAgentService,
    KaasKnowledgeService,
    KaasCreditService,
    KaasProvenanceService,
    KaasCuratorRewardService,
    KaasWsGateway,
  ],
})
export class KaasModule {}
