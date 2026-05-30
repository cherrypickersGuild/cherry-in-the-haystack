/**
 * POST /api/v1/kaas/agents/:id/install-build
 *
 * Push a Workshop build (prompt / skills / orch / memory card ids) to a
 * connected Claude Code agent as ~/.claude/skills/cherry-<name>/SKILL.md
 * files via the existing save_skill_request WebSocket flow.
 *
 * Spec: apps/docs/install-skill/1-work-guidelines.md §6.
 */

import {
  Body,
  Controller,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AuthUser } from 'src/common/decorators/auth-user.decorator';

import { InstallBuildService } from './install-build.service';
import type { InstallBuildRequest } from './install-build.service';

@Controller('v1/kaas/agents')
@ApiTags('KaaS — Install Skill')
export class InstallBuildController {
  constructor(private readonly svc: InstallBuildService) {}

  @Post(':id/install-build')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Workshop 빌드를 연결된 Claude Code 에이전트로 설치',
  })
  async install(
    @AuthUser('id') userId: string,
    @Param('id') agentId: string,
    @Body() body: InstallBuildRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.svc.install(userId, agentId, body);
    res.status(this.svc.classifyResult(result));
    return result;
  }
}
