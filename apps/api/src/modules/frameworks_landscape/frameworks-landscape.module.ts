import { Module } from '@nestjs/common';
import { FrameworksLandscapeController } from './frameworks-landscape.controller';
import { FrameworksLandscapeService } from './frameworks-landscape.service';
import { OverviewConfigController } from './overview-config.controller';
import { OverviewConfigService } from './overview-config.service';

@Module({
  controllers: [FrameworksLandscapeController, OverviewConfigController],
  providers: [FrameworksLandscapeService, OverviewConfigService],
  exports: [FrameworksLandscapeService, OverviewConfigService],
})
export class FrameworksLandscapeModule {}
