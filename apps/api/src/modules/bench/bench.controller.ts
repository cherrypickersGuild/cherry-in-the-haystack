import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'

import {
  BenchService,
  type BenchCompareResponse,
  type BenchRunResponse,
} from './bench.service'
import type { BenchSetSummary } from './sets/set-definitions'
import type { AgentBuildInput } from './cards/compose-runtime'
import { searchMarketplace } from './tools/marketplace.tool'
import { fetchCryptoPrice } from './tools/coingecko.tool'
import { searchCatalog } from './tools/catalog.tool'

@Controller('v1/kaas/bench')
@ApiTags('KaaS — Bench (Workshop Before/After demo)')
export class BenchController {
  private readonly logger = new Logger(BenchController.name)

  constructor(private readonly bench: BenchService) {}

  @Get('sets')
  @ApiOperation({
    summary: 'List the 3 benchmark sets (UI chrome: id, name, task, skills).',
  })
  listSets(): BenchSetSummary[] {
    return this.bench.listSets()
  }

  @Post('compare')
  @ApiOperation({
    summary:
      'Run baseline + enhanced Claude calls for the given set, evaluate both, return metrics.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['setId'],
      properties: {
        setId: {
          type: 'string',
          enum: ['set-2-hunter', 'set-3-policy', 'set-4-quant', 'set-6-grounded'],
        },
      },
    },
  })
  async compare(
    @Body() body: { setId?: string },
  ): Promise<BenchCompareResponse> {
    const setId = body?.setId
    if (!setId || typeof setId !== 'string') {
      throw new HttpException(
        { statusCode: 400, code: 'BENCH_INVALID_SET', message: 'setId is required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    try {
      return await this.bench.compare(setId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[bench] compare failed · setId=${setId} · ${msg}`)
      throw new HttpException(
        {
          statusCode: 500,
          code: 'BENCH_COMPARE_FAILED',
          message: msg,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('run')
  @ApiOperation({
    summary:
      "Run a task against the user's equipped Workshop build. Baseline is empty-build; enhanced composes the runtime from card ids (prompt/mcp/memory). Empty build ⇒ enhanced ≈ baseline.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['taskId', 'build'],
      properties: {
        taskId: {
          type: 'string',
          enum: ['set-2-hunter', 'set-3-policy', 'set-4-quant', 'set-6-grounded'],
        },
        build: {
          type: 'object',
          properties: {
            prompt: { type: 'string', nullable: true },
            mcp: { type: 'string', nullable: true },
            skillA: { type: 'string', nullable: true },
            skillB: { type: 'string', nullable: true },
            skillC: { type: 'string', nullable: true },
            orchestration: { type: 'string', nullable: true },
            memory: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  async run(
    @Body()
    body: { taskId?: string; build?: Partial<AgentBuildInput> },
  ): Promise<BenchRunResponse> {
    const taskId = body?.taskId
    if (!taskId || typeof taskId !== 'string') {
      throw new HttpException(
        { statusCode: 400, code: 'BENCH_INVALID_TASK', message: 'taskId is required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    const build: AgentBuildInput = {
      prompt: body?.build?.prompt ?? null,
      mcp: body?.build?.mcp ?? null,
      skillA: body?.build?.skillA ?? null,
      skillB: body?.build?.skillB ?? null,
      skillC: body?.build?.skillC ?? null,
      orchestration: body?.build?.orchestration ?? null,
      memory: body?.build?.memory ?? null,
    }
    try {
      return await this.bench.run(taskId, build)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`[bench] run failed · taskId=${taskId} · ${msg}`)
      throw new HttpException(
        {
          statusCode: 500,
          code: 'BENCH_RUN_FAILED',
          message: msg,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     Agent-facing tool endpoints — called by cherry-kaas MCP (agent-package)
     so Claude Code hits the SAME seeded data as the web bench. No auth:
     tools are readonly and the seed is public demo content.
     ════════════════════════════════════════════════════════════════ */

  @Post('tools/search-marketplace')
  @ApiOperation({
    summary:
      'Agent MCP tool — query seeded marketplace listings (Hunter Set 2). Mirrors the bench tool exactly.',
  })
  async toolSearchMarketplace(
    @Body()
    body: { query?: string; max_price?: number; sealed_only?: boolean },
  ): Promise<ReturnType<typeof searchMarketplace>> {
    const query = typeof body?.query === 'string' ? body.query : ''
    if (!query.trim()) {
      throw new HttpException(
        { statusCode: 400, code: 'TOOL_QUERY_REQUIRED', message: 'query is required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    // Strip common generic tokens so "LG Gram 16 laptop" still matches the
    // `LG Gram 16` seed. Safe because seed has no laptop/notebook/... tokens.
    const STOP = new Set([
      'laptop', 'laptops', 'notebook', 'notebooks', 'computer', 'computers',
      'pc', 'pcs', 'sealed', 'new', 'used', 'opened', 'box',
    ])
    const cleaned =
      query
        .split(/\s+/)
        .filter((t) => t && !STOP.has(t.toLowerCase()))
        .join(' ')
        .trim() || query
    return searchMarketplace({
      query: cleaned,
      max_price: typeof body?.max_price === 'number' ? body.max_price : undefined,
      sealed_only: typeof body?.sealed_only === 'boolean' ? body.sealed_only : undefined,
    })
  }

  @Post('tools/search-cherry-docs')
  @ApiOperation({
    summary:
      'Agent MCP tool — seeded Cherry internal docs (Policy Set 3 / Grounded Set 6). Mirrors bench search_catalog (karma-v2.md).',
  })
  async toolSearchCherryDocs(
    @Body() body: { query?: string; limit?: number },
  ): Promise<ReturnType<typeof searchCatalog>> {
    const query = typeof body?.query === 'string' ? body.query : ''
    if (!query.trim()) {
      throw new HttpException(
        { statusCode: 400, code: 'TOOL_QUERY_REQUIRED', message: 'query is required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return searchCatalog({
      query,
      limit: typeof body?.limit === 'number' ? body.limit : undefined,
    })
  }

  @Post('tools/get-crypto-price')
  @ApiOperation({
    summary:
      'Agent MCP tool — CoinGecko spot price (Oracle Set 1 / Quant Set 4). Mirrors the bench tool exactly.',
  })
  async toolGetCryptoPrice(
    @Body() body: { symbol?: string },
  ): Promise<Awaited<ReturnType<typeof fetchCryptoPrice>>> {
    const symbol = typeof body?.symbol === 'string' ? body.symbol.trim() : ''
    if (!symbol) {
      throw new HttpException(
        { statusCode: 400, code: 'TOOL_SYMBOL_REQUIRED', message: 'symbol is required' },
        HttpStatus.BAD_REQUEST,
      )
    }
    try {
      return await fetchCryptoPrice(symbol)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new HttpException(
        { statusCode: 502, code: 'TOOL_COINGECKO_FAILED', message: msg },
        HttpStatus.BAD_GATEWAY,
      )
    }
  }
}
