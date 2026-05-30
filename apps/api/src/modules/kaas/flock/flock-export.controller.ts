import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  FlockExportService,
  type FlockExportRequest,
  type FlockExportResponse,
} from './flock-export.service'
import {
  AgentverseExportService,
  type AgentverseExportRequest,
  type AgentverseExportResponse,
} from './agentverse-export.service'
import {
  FlockBundleService,
  type FlockBundleRequest,
  type FlockBundleResponse,
} from './flock-bundle.service'

@Controller('v1/kaas/flock')
@ApiTags('KaaS — Flock Export')
export class FlockExportController {
  constructor(
    private readonly svc: FlockExportService,
    private readonly agentverse: AgentverseExportService,
    private readonly bundle: FlockBundleService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Whether the server has a Flockx API key in env' })
  config() {
    return {
      server_key_configured: Boolean(process.env.FLOCKX_API_KEY || process.env.FLOCK_API_KEY),
      key_source: process.env.FLOCKX_API_KEY
        ? 'FLOCKX_API_KEY'
        : process.env.FLOCK_API_KEY
          ? 'FLOCK_API_KEY (fallback — may not be a flockx token)'
          : null,
    }
  }

  @Post('export-build')
  @HttpCode(200)
  @ApiOperation({ summary: 'Export Workshop build to flockx.io as a public agent' })
  async exportBuild(@Body() body: FlockExportRequest): Promise<FlockExportResponse> {
    return this.svc.export(body)
  }

  @Get('agentverse-config')
  @ApiOperation({ summary: 'Whether the server has an Agentverse API key in env' })
  agentverseConfig() {
    return { server_key_configured: Boolean(process.env.AGENTVERSE_API_KEY) }
  }

  @Post('export-agentverse')
  @HttpCode(200)
  @ApiOperation({ summary: 'Export Workshop build to Agentverse marketplace' })
  async exportAgentverse(@Body() body: AgentverseExportRequest): Promise<AgentverseExportResponse> {
    return this.agentverse.export(body)
  }

  @Post('flock-bundle')
  @HttpCode(200)
  @ApiOperation({ summary: 'Build a FLock-ready upload bundle (manual co-creation)' })
  flockBundle(@Body() body: FlockBundleRequest): FlockBundleResponse {
    return this.bundle.build(body)
  }
}
