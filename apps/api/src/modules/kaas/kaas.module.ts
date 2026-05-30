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
import { KaasA2aController } from './kaas-a2a.controller';
import { KaasAcpController } from './kaas-acp.controller';
import { KaasWsGateway } from './kaas-ws.gateway';
import { InstallBuildController } from './install-build.controller';
import { ShopController } from './shop/shop.controller';
import { AgentTradeController } from './shop/agent-trade.controller';
import { FlockExportController } from './flock/flock-export.controller';

import { KaasAgentService } from './kaas-agent.service';
import { KaasKnowledgeService } from './kaas-knowledge.service';
import { KaasCreditService } from './kaas-credit.service';
import { KaasProvenanceService } from './kaas-provenance.service';
import { KaasCuratorRewardService } from './kaas-curator-reward.service';
import { KaasA2aService } from './kaas-a2a.service';
import { KaasAgentDaemonService } from './kaas-agent-daemon.service';
import { InstallBuildService } from './install-build.service';
import { BuySetService } from './shop/buy-set.service';
import { AgentTradeService } from './shop/agent-trade.service';
import { FlockExportService } from './flock/flock-export.service';
import { AgentverseExportService } from './flock/agentverse-export.service';
import { FlockBundleService } from './flock/flock-bundle.service';

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
    KaasA2aController,
    KaasAcpController,
    InstallBuildController,
    ShopController,
    AgentTradeController,
    FlockExportController,
  ],
  providers: [
    KaasAgentService,
    KaasKnowledgeService,
    KaasCreditService,
    KaasProvenanceService,
    KaasCuratorRewardService,
    KaasWsGateway,
    KaasA2aService,
    KaasAgentDaemonService,
    InstallBuildService,
    BuySetService,
    AgentTradeService,
    FlockExportService,
    AgentverseExportService,
    FlockBundleService,
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
