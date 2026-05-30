/**
 * ShopController — consumer Shop endpoints.
 *
 * Exposes:
 *   GET  /v1/kaas/shop/sets             — list all ShopSet bundles
 *   POST /v1/kaas/shop/buy-and-install  — purchase + install a set to an agent
 *
 * The purchase path wraps the existing InstallBuildService in a credit
 * deduction + provenance layer. Partial failures fully refund so a
 * broken install never costs the user credits.
 */

import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { SHOP_SETS, type ShopSet } from './shop-sets.registry'
import { BuySetService, type BuySetResponse } from './buy-set.service'
import { CARD_REGISTRY } from '../../bench/cards/card-registry'

@Controller('v1/kaas/shop')
@ApiTags('KaaS — Shop (consumer storefront)')
export class ShopController {
  constructor(private readonly buySet: BuySetService) {}

  @Get('sets')
  @ApiOperation({
    summary: 'List Shop set bundles (domain → canonical Workshop build).',
  })
  listSets(): ShopSet[] {
    return SHOP_SETS
  }

  /**
   * Read-only card source — surfaces the systemPrompt / promptSuffix / tool
   * schema that actually ships in the SKILL.md on install. The Workshop UI
   * uses this so users can peek inside a card before dragging it.
   */
  @Get('cards/:id/source')
  @ApiOperation({
    summary: 'Return the raw card source (read-only) for a Workshop card.',
  })
  cardSource(@Param('id') id: string): {
    id: string
    type: string
    body: string
    language: string
  } {
    const card = CARD_REGISTRY[id]
    if (!card) {
      throw new HttpException(
        { code: 'CARD_NOT_FOUND', message: `Unknown card id: ${id}` },
        HttpStatus.NOT_FOUND,
      )
    }
    if (card.type === 'prompt') {
      return { id, type: 'prompt', body: card.systemPrompt, language: 'markdown' }
    }
    if (card.type === 'skill') {
      return { id, type: 'skill', body: card.promptSuffix, language: 'markdown' }
    }
    if (card.type === 'mcp') {
      return {
        id,
        type: 'mcp',
        body: JSON.stringify(card.tool.definition, null, 2),
        language: 'json',
      }
    }
    if (card.type === 'memory') {
      return {
        id,
        type: 'memory',
        body: JSON.stringify(
          { mode: card.mode, maxIterations: card.maxIterations },
          null,
          2,
        ),
        language: 'json',
      }
    }
    if (card.type === 'orchestration') {
      return {
        id,
        type: 'orchestration',
        body: JSON.stringify({ orchId: card.orchId }, null, 2),
        language: 'json',
      }
    }
    // exhaustive — TS will flag if a new variant appears
    const _exhaustive: never = card
    throw new HttpException(
      { code: 'UNKNOWN_CARD_TYPE' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }

  @Post('buy-and-install')
  @ApiOperation({
    summary:
      'Purchase a Shop set and install it onto the caller’s agent. Credits are deducted and provenance recorded before InstallBuildService fires; any install failure triggers a full refund.',
  })
  async buyAndInstall(
    @Body()
    body: {
      set_id?: string
      api_key?: string
      chain?: 'status' | 'near' | 'mock'
    },
  ): Promise<BuySetResponse> {
    if (!body?.set_id || !body?.api_key) {
      throw new HttpException(
        { code: 'BAD_REQUEST', message: 'set_id and api_key are required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.buySet.execute(
      body.set_id,
      body.api_key,
      body.chain ?? 'status',
    )
  }
}
