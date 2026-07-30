import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from 'src/middleware/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/role';
import { OverviewConfigService } from './overview-config.service';

@Controller('overview')
@ApiTags('Overview')
export class OverviewConfigController {
  constructor(private readonly service: OverviewConfigService) {}

  @Get('config')
  @ApiOperation({ summary: 'Overview 구성 조회 (auto/admin 병합)' })
  async getConfig() {
    return this.service.getConfig();
  }

  /* ── 관리자 편집 (ADMIN 전용) ── */

  @Put('slot/:slot')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] 슬롯 저장 (title|hero|spotlight|justAdded|block:<key>)' })
  async saveSlot(@Param('slot') slot: string, @Body() body: any, @Req() req: any) {
    const email = req?.user?.email ?? req?.user?.role ?? 'admin';
    return this.service.saveSlot(slot, body, email);
  }

  @Delete('slot/:slot')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] 슬롯 자동 리셋(재생성)' })
  async resetSlot(@Param('slot') slot: string) {
    return this.service.resetSlot(slot);
  }

  @Post('regenerate')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[ADMIN] 자동 슬롯 전체 재생성(building-blocks 기준)' })
  async regenerate() {
    await this.service.regenerate();
    return this.service.getConfig();
  }
}
