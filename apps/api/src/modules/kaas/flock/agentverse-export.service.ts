/**
 * AgentverseExportService — push a Workshop build to Agentverse marketplace
 * (fetch.ai's official agent directory). This is the "real" backend that
 * flockx auto-publishes to; we go directly to bypass the flockx middleman
 * since flockx /workbench/api-keys is gated for regular users while
 * Agentverse keys are freely issuable from the avatar dropdown.
 *
 * Endpoint: POST https://agentverse.ai/v1/hosting/agents (hosted Python
 * agent stub — minimal viable listing). The full register_with_agentverse
 * SDK flow requires secp256k1 signing of an Almanac registration; that's
 * heavy to port to TS. For hackathon we use the hosted-agent path which
 * Agentverse provisions on its side, listed on the public marketplace.
 *
 * Auth: caller-supplied or AGENTVERSE_API_KEY env (Bearer token).
 */

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

import {
  collectSkillFiles,
  type BuildContext,
} from '../../bench/cards/serialize'
import type { AgentBuildInput } from '../../bench/cards/compose-runtime'

const AGENTVERSE_BASE = 'https://agentverse.ai/v1'
const REQUEST_TIMEOUT_MS = 20_000

export interface AgentverseExportRequest {
  build_id: string
  build_name: string
  build_summary?: string
  equipped: AgentBuildInput
  api_key?: string
  public?: boolean
}

export interface AgentverseExportResponse {
  agent: {
    address?: string
    name: string
    readme: string
    raw: any
  }
  public_url_candidates: string[]
  warnings: string[]
}

@Injectable()
export class AgentverseExportService {
  private readonly logger = new Logger(AgentverseExportService.name)

  async export(req: AgentverseExportRequest): Promise<AgentverseExportResponse> {
    const apiKey =
      req.api_key?.trim() || process.env.AGENTVERSE_API_KEY || ''
    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_API_KEY',
          message:
            'Agentverse API key required. Set AGENTVERSE_API_KEY in apps/api/.env or paste in the modal.',
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    const ctx: BuildContext = {
      buildId: req.build_id,
      buildName: req.build_name,
      agentId: 'agentverse-export',
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

    // Compose the README — Agentverse marketplace shows this on the agent page.
    const readme = this.composeReadme(req.build_name, promptFile?.body, skillFiles, req.build_summary)

    const warnings: string[] = []
    if (skipped.length > 0) {
      warnings.push(`${skipped.length} slot(s) skipped (mcp/orchestration/memory aren't published)`)
    }

    // Hosted Python agent — simplest stub that registers on the marketplace.
    // Agentverse requires a runnable agent.py; we provide a minimal echo bot
    // whose system prompt + readme contain the actual Cherry build content.
    const agentCode = this.composeAgentCode(req.build_name, promptFile?.body ?? '')

    const body = {
      name: req.build_name || 'Cherry Workshop Agent',
      readme,
      agent_type: 'hosted',
      code: agentCode,
      short_description: req.build_summary?.slice(0, 200)
        ?? this.firstParagraph(promptFile?.body, 200)
        ?? 'Built in Cherry KaaS Workshop',
    }

    let resp: any
    try {
      resp = await this.agentverseFetch('/hosting/agents', apiKey, 'POST', body)
    } catch (err) {
      // Fall back: try /agents (Almanac-style) without the hosted-code requirement
      this.logger.warn(`hosting/agents failed, trying /agents — ${err instanceof Error ? err.message : err}`)
      try {
        resp = await this.agentverseFetch('/agents', apiKey, 'POST', {
          name: body.name,
          readme: body.readme,
          short_description: body.short_description,
        })
      } catch (err2) {
        throw err2
      }
    }

    const address: string | undefined = resp?.address ?? resp?.agent_address ?? resp?.id
    return {
      agent: {
        address,
        name: body.name,
        readme,
        raw: resp,
      },
      public_url_candidates: this.buildUrlCandidates(address ?? ''),
      warnings,
    }
  }

  // ── helpers ──

  private async agentverseFetch(
    path: string,
    apiKey: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<any> {
    const url = `${AGENTVERSE_BASE}${path}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      let parsed: any = null
      try { parsed = text ? JSON.parse(text) : null } catch { parsed = { raw: text } }
      if (!res.ok) {
        const msg = parsed?.detail ?? parsed?.message ?? `agentverse ${path} ${res.status}`
        throw new HttpException(
          { code: 'AGENTVERSE_HTTP_ERROR', status: res.status, message: msg, detail: parsed },
          res.status === 401 ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_GATEWAY,
        )
      }
      return parsed
    } finally {
      clearTimeout(t)
    }
  }

  private composeReadme(
    name: string,
    promptBody: string | undefined,
    skills: { cardId: string; body: string }[],
    summary?: string,
  ): string {
    const parts: string[] = []
    parts.push(`# ${name}`)
    if (summary) parts.push(summary)
    parts.push('')
    parts.push('Published from **Cherry KaaS Workshop** — composed from a system prompt and a stack of skill cards.')
    if (promptBody) {
      parts.push('')
      parts.push('## System prompt')
      parts.push('')
      parts.push(this.stripFrontmatter(promptBody))
    }
    if (skills.length) {
      parts.push('')
      parts.push('## Skills')
      for (const s of skills) {
        parts.push(`### ${s.cardId}`)
        parts.push(this.stripFrontmatter(s.body))
        parts.push('')
      }
    }
    parts.push('')
    parts.push('---')
    parts.push('Built with [Cherry KaaS](https://solteti.site).')
    return parts.join('\n')
  }

  /** Minimal hosted agent — echoes back the user's message via the system
   *  prompt baked in. Agentverse requires runnable Python; this is the
   *  smallest valid agent that can register on the marketplace. */
  private composeAgentCode(name: string, systemPrompt: string): string {
    const safeName = JSON.stringify(name)
    const safePrompt = JSON.stringify(this.stripFrontmatter(systemPrompt || ''))
    return `from uagents import Agent, Context, Model

class Message(Model):
    text: str

agent = Agent(name=${safeName})
SYSTEM_PROMPT = ${safePrompt}

@agent.on_message(model=Message)
async def echo(ctx: Context, sender: str, msg: Message):
    ctx.logger.info(f"received: {msg.text}")
    await ctx.send(sender, Message(text=f"[{${safeName}}] {SYSTEM_PROMPT[:200]}\\n\\nYou said: {msg.text}"))

if __name__ == "__main__":
    agent.run()
`
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

  private buildUrlCandidates(address: string): string[] {
    if (!address) return ['https://agentverse.ai/agents']
    return [
      `https://agentverse.ai/agents/details/${address}`,
      `https://agentverse.ai/agents/${address}`,
      `https://agentverse.ai/marketplace/agents/${address}`,
    ]
  }
}
