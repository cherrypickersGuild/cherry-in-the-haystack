/**
 * AgentTradeController — Shop "By Agent" tab endpoints.
 *
 *   GET  /v1/kaas/shop/agents              — list other active agents
 *   GET  /v1/kaas/shop/agents/:id/diff     — diff target vs caller
 *   POST /v1/kaas/shop/agents/skills/buy   — buy a single SKILL.md (5cr flat)
 */

import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { AgentTradeService } from './agent-trade.service'

@Controller('v1/kaas/shop/agents')
@ApiTags('KaaS — Shop · Agent Trade')
export class AgentTradeController {
  constructor(private readonly svc: AgentTradeService) {}

  @Get()
  @ApiOperation({ summary: 'List other active agents (caller excluded).' })
  list(@Query('exclude_self') excludeSelf?: string) {
    return this.svc.listAgents(excludeSelf)
  }

  @Get(':id/diff')
  @ApiOperation({
    summary:
      'Diff a target agent vs caller. Both sides fetched live via self-report.',
  })
  diff(
    @Param('id') id: string,
    @Query('vs_api_key') vsApiKey?: string,
  ) {
    if (!vsApiKey) {
      throw new HttpException(
        { code: 'BAD_REQUEST', message: 'vs_api_key is required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.svc.diff(id, vsApiKey)
  }

  @Post('skills/buy')
  @ApiOperation({
    summary:
      'Charge a flat 5 credits and install a single SKILL.md (concept or Workshop card) onto the caller’s agent.',
  })
  buy(@Body() body: { slug?: string; api_key?: string }) {
    if (!body?.slug || !body?.api_key) {
      throw new HttpException(
        { code: 'BAD_REQUEST', message: 'slug and api_key are required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.svc.buySingle(body.slug, body.api_key)
  }
}
