/**
 * FlockMarketplaceExportService — push a Workshop build to FLock.io's
 * marketplace via the (undocumented but live) `POST /v1/agents` endpoint
 * on api.flock.io.
 *
 * Probed 2026-04-25 with the existing FLOCK_API_KEY:
 *   POST /v1/agents  →  403 "Only proxy admins can create agents.
 *                            Your role=internal_user"
 *
 * Required body fields (per 422 response): `agent_name`, `agent_card_params`.
 * Once the FLock team upgrades the user's role to `proxy_admin`, the same
 * call should succeed. We send what we can guess from the OpenAI-compat
 * surface (LiteLLM proxy under the hood).
 */

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

import {
  collectSkillFiles,
  type BuildContext,
} from '../../bench/cards/serialize'
import type { AgentBuildInput } from '../../bench/cards/compose-runtime'

const FLOCK_BASE = 'https://api.flock.io/v1'
const REQUEST_TIMEOUT_MS = 20_000

export interface FlockMarketplaceExportRequest {
  build_id: string
  build_name: string
  build_summary?: string
  equipped: AgentBuildInput
  api_key?: string
}

export interface FlockMarketplaceExportResponse {
  agent: {
    name: string
    description: string
    raw: any
  }
  public_url_candidates: string[]
  warnings: string[]
}

@Injectable()
export class FlockMarketplaceExportService {
  private readonly logger = new Logger(FlockMarketplaceExportService.name)

  async export(req: FlockMarketplaceExportRequest): Promise<FlockMarketplaceExportResponse> {
    const apiKey = req.api_key?.trim() || process.env.FLOCK_API_KEY || ''
    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_API_KEY',
          message: 'FLock API key required. Set FLOCK_API_KEY in apps/api/.env.',
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    const ctx: BuildContext = {
      buildId: req.build_id,
      buildName: req.build_name,
      agentId: 'flock-marketplace-export',
      installedAt: new Date().toISOString(),
      runId: uuidv4().slice(0, 8),
    }
    const { files, skipped } = collectSkillFiles(req.equipped, ctx)
    if (files.length === 0) {
      throw new HttpException(
        { code: 'EMPTY_BUILD', message: 'Equip at least one card before publishing.' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const promptFile = files.find((f) => f.slot === 'prompt')
    const skillFiles = files.filter((f) => f.slot.startsWith('skill'))

    const description = req.build_summary
      ?? this.firstParagraph(promptFile?.body, 240)
      ?? 'Built in Cherry KaaS Workshop'

    const systemPrompt = this.composeSystemPrompt(promptFile?.body, skillFiles)

    const body = {
      agent_name: req.build_name || 'Cherry Workshop Agent',
      agent_card_params: {
        description,
        system_prompt: systemPrompt,
        model: 'qwen3-30b-a3b-instruct-2507',
        metadata: {
          source: 'cherry-kaas',
          build_id: req.build_id,
          build_name: req.build_name,
          run_id: ctx.runId,
          skills: files.map((f) => ({ slot: f.slot, card_id: f.cardId })),
        },
      },
    }

    const warnings: string[] = []
    if (skipped.length) {
      warnings.push(`${skipped.length} slot(s) skipped (mcp/orchestration/memory aren't published)`)
    }

    const resp = await this.flockFetch('/agents', apiKey, 'POST', body)

    return {
      agent: {
        name: body.agent_name,
        description,
        raw: resp,
      },
      public_url_candidates: this.buildUrlCandidates(resp),
      warnings,
    }
  }

  // ── helpers ──

  private async flockFetch(
    path: string,
    apiKey: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<any> {
    const url = `${FLOCK_BASE}${path}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          'x-litellm-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      let parsed: any = null
      try { parsed = text ? JSON.parse(text) : null } catch { parsed = { raw: text } }
      if (!res.ok) {
        const detail = parsed?.detail ?? parsed?.error ?? parsed
        const msg =
          typeof detail === 'string'
            ? detail
            : detail?.error ?? detail?.message ?? `flock ${path} ${res.status}`
        // Special-case the role gate so the UI can surface it cleanly.
        if (
          res.status === 403 &&
          typeof msg === 'string' &&
          /proxy admin/i.test(msg)
        ) {
          throw new HttpException(
            {
              code: 'FLOCK_ROLE_GATED',
              status: 403,
              message:
                'FLock account role is `internal_user`. Need `proxy_admin` role to publish to marketplace. Email contact@flock.io to upgrade.',
              detail: parsed,
            },
            HttpStatus.FORBIDDEN,
          )
        }
        throw new HttpException(
          { code: 'FLOCK_HTTP_ERROR', status: res.status, message: msg, detail: parsed },
          res.status === 401 ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_GATEWAY,
        )
      }
      return parsed
    } finally {
      clearTimeout(t)
    }
  }

  private composeSystemPrompt(
    promptBody: string | undefined,
    skills: { cardId: string; body: string }[],
  ): string {
    const parts: string[] = []
    if (promptBody) parts.push(this.stripFrontmatter(promptBody))
    for (const s of skills) {
      parts.push(`\n## ${s.cardId}`)
      parts.push(this.stripFrontmatter(s.body))
    }
    return parts.join('\n').trim()
  }

  private stripFrontmatter(md: string): string {
    return md
      .replace(/^---[\s\S]*?---/m, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  }

  private firstParagraph(md: string | undefined, max: number): string {
    if (!md) return ''
    const stripped = this.stripFrontmatter(md).replace(/^#+\s.*/gm, '').trim()
    const p = stripped.split(/\n\s*\n/).find((x) => x.trim().length > 0) ?? ''
    return p.slice(0, max).trim()
  }

  private buildUrlCandidates(resp: any): string[] {
    const id = resp?.id ?? resp?.agent_id ?? resp?.uuid
    if (!id) return ['https://platform.flock.io/marketplace', 'https://flock.io/ai-marketplace']
    return [
      `https://platform.flock.io/marketplace/agents/${id}`,
      `https://flock.io/ai-marketplace/agents/${id}`,
      `https://platform.flock.io/agents/${id}`,
    ]
  }
}
