import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FrameworksLandscapeService,
  Landscape,
  isLandscapePage,
} from './frameworks-landscape.service';

/** GET /api/:page/landscape — page ∈ {frameworks, prompting} */
@Controller()
@ApiTags('Landscape')
export class FrameworksLandscapeController {
  constructor(private readonly service: FrameworksLandscapeService) {}

  @Get(':page/landscape')
  @ApiOperation({ summary: 'Landscape 조회 (page=frameworks|prompting, 8카드 × top5)' })
  async getLandscape(@Param('page') page: string): Promise<Landscape> {
    if (!isLandscapePage(page)) throw new NotFoundException(`unknown landscape page: ${page}`);
    return this.service.getLandscape(page);
  }
}
