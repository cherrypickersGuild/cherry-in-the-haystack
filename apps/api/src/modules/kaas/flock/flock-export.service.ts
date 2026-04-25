/**
 * FlockExportService — push a Workshop build to flockx.io as a public agent.
 *
 * Flow (mirrors InstallBuildService but swaps the WS transport for HTTPS):
 *   1. Serialize build → SkillFile[] via the same collectSkillFiles() used by Install Skill.
 *   2. POST /api/v1/agents (flockx)            → agent_id + agent_handle
 *   3. POST /api/v1/knowledge-graphs           → kg_id (best-effort; some flockx tiers scope KG under twin)
 *   4. POST /api/v1/documents per skill body   → attach to KG
 *   5. Return all candidate public URLs so the UI can show whichever resolves.
 *
 * Auth: caller-supplied `Authorization: Token <key>` (no Cherry-side storage —
 * the user pastes their flockx key per export, like a one-shot).
 */

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

import {
  collectSkillFiles,
  type BuildContext,
  type SkillFile,
} from '../../bench/cards/serialize'
import type { AgentBuildInput } from '../../bench/cards/compose-runtime'

const FLOCKX_BASE = 'https://api.flockx.io/api/v1'
const REQUEST_TIMEOUT_MS = 15_000

export interface FlockExportRequest {
  build_id: string
  build_name: string
  build_summary?: string
  equipped: AgentBuildInput
  api_key: string
  /** When false, the agent is private to the flockx user. Default true → marketplace listed. */
  public?: boolean
}

export interface FlockExportResponse {
  agent: {
    id: string
    handle?: string
    address?: string
    raw: any
  }
  knowledge_graph?: { id: string; raw: any } | null
  documents: Array<{ slot: string; card_id: string; document_id?: string; ok: boolean; error?: string }>
  /** URL candidates we *believe* might be the public marketplace page. The UI
   *  should render all of them as clickable links; flockx's docs don't pin a
   *  single canonical pattern. */
  public_url_candidates: string[]
  warnings: string[]
}

@Injectable()
export class FlockExportService {
  private readonly logger = new Logger(FlockExportService.name)

  async export(req: FlockExportRequest): Promise<FlockExportResponse> {
    // Prefer caller-supplied key; fall back to server-side env. FLOCKX_API_KEY
    // is the canonical name; FLOCK_API_KEY is a best-effort fallback for users
    // who only set the inference key (different product but same parent — may
    // or may not work depending on flockx auth scheme).
    const apiKey =
      req.api_key?.trim() ||
      process.env.FLOCKX_API_KEY ||
      process.env.FLOCK_API_KEY ||
      ''
    if (!apiKey) {
      throw new HttpException(
        {
          code: 'MISSING_API_KEY',
          message:
            'flockx.io API key required. Provide one in the modal or set FLOCKX_API_KEY on the server.',
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    const ctx: BuildContext = {
      buildId: req.build_id,
      buildName: req.build_name,
      agentId: 'flockx-export',
      installedAt: new Date().toISOString(),
      runId: uuidv4().slice(0, 8),
    }
    const { files, skipped } = collectSkillFiles(req.equipped, ctx)

    if (files.length === 0) {
      throw new HttpException(
        { code: 'EMPTY_BUILD', message: 'Nothing to export — equip at least a prompt or skill card.' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const promptFile = files.find((f) => f.slot === 'prompt') ?? files[0]
    const skillFiles = files.filter((f) => f.slot.startsWith('skill'))

    const warnings: string[] = []
    if (skipped.length > 0) {
      warnings.push(`${skipped.length} slot(s) skipped (mcp/orchestration/memory aren't pushed to flockx)`)
    }

    // 1. Create the agent
    const agentBody = {
      name: req.build_name || 'Cherry Workshop Agent',
      character: this.firstParagraph(promptFile?.body, 240) || req.build_name,
      personality: req.build_summary || promptFile?.description || 'Built in Cherry KaaS Workshop',
      personal: req.public === false ? true : false,
      category: 'developer',
      meta_data: {
        source: 'cherry-kaas',
        build_id: req.build_id,
        build_name: req.build_name,
        run_id: ctx.runId,
        skills: files.map((f) => ({ slot: f.slot, card_id: f.cardId })),
      },
    }

    const agentResp = await this.flockxFetch('/agents', apiKey, 'POST', agentBody)
    const agentId = agentResp?.id ?? agentResp?.uuid ?? agentResp?.agent_id
    const agentHandle: string | undefined = agentResp?.agent_handle
    const agentAddress: string | undefined = agentResp?.agent_address
    if (!agentId) {
      throw new HttpException(
        { code: 'AGENT_CREATE_FAILED', message: 'flockx /agents returned no id', detail: agentResp },
        HttpStatus.BAD_GATEWAY,
      )
    }
    this.logger.log(`flockx agent created: ${agentId} handle=${agentHandle}`)

    // 2. Knowledge graph (best-effort — some flockx accounts may have it scoped differently)
    let kg: { id: string; raw: any } | null = null
    try {
      const kgResp = await this.flockxFetch('/knowledge-graphs', apiKey, 'POST', {
        name: `${req.build_name} – Cherry KG`,
        agent_id: agentId,
        description: 'Auto-generated by Cherry KaaS Export',
      })
      const kgId = kgResp?.id ?? kgResp?.uuid
      if (kgId) {
        kg = { id: kgId, raw: kgResp }
        this.logger.log(`flockx kg created: ${kgId}`)
      } else {
        warnings.push('Knowledge graph created but no id returned')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      warnings.push(`Knowledge graph creation failed: ${msg}`)
    }

    // 3. Upload each skill body as a document
    const documents: FlockExportResponse['documents'] = []
    if (kg) {
      for (const file of skillFiles) {
        try {
          const docResp = await this.flockxFetch('/documents', apiKey, 'POST', {
            name: `${file.cardId}.md`,
            knowledge_graph: kg.id,
            data: { content: file.body, format: 'markdown' },
          })
          documents.push({
            slot: file.slot,
            card_id: file.cardId,
            document_id: docResp?.id,
            ok: true,
          })
        } catch (err) {
          documents.push({
            slot: file.slot,
            card_id: file.cardId,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    // 4. Build URL candidates — docs don't pin canonical so UI shows all.
    const publicUrlCandidates = this.buildUrlCandidates({ id: String(agentId), handle: agentHandle })

    return {
      agent: {
        id: String(agentId),
        handle: agentHandle,
        address: agentAddress,
        raw: agentResp,
      },
      knowledge_graph: kg,
      documents,
      public_url_candidates: publicUrlCandidates,
      warnings,
    }
  }

  // ── helpers ──

  private async flockxFetch(
    path: string,
    apiKey: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<any> {
    const url = `${FLOCKX_BASE}${path}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      let parsed: any = null
      try { parsed = text ? JSON.parse(text) : null } catch { parsed = { raw: text } }
      if (!res.ok) {
        const msg = parsed?.detail ?? parsed?.message ?? `flockx ${path} ${res.status}`
        throw new HttpException(
          { code: 'FLOCKX_HTTP_ERROR', status: res.status, message: msg, detail: parsed },
          res.status === 401 ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_GATEWAY,
        )
      }
      return parsed
    } finally {
      clearTimeout(timer)
    }
  }

  private firstParagraph(md: string | undefined, max: number): string {
    if (!md) return ''
    // Strip frontmatter + html comments + first heading; take first non-empty paragraph
    const stripped = md
      .replace(/^---[\s\S]*?---/m, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^#+\s.*/gm, '')
      .trim()
    const firstPara = stripped.split(/\n\s*\n/).find((p) => p.trim().length > 0) ?? ''
    return firstPara.slice(0, max).trim()
  }

  private buildUrlCandidates(agent: { id: string; handle?: string }): string[] {
    const handle = agent.handle?.replace(/^@/, '') ?? ''
    const out: string[] = []
    if (handle) {
      out.push(`https://agents.flockx.io/${handle}`)
      out.push(`https://flockx.io/agents/${handle}`)
      // @x.av handles imply Agentverse / ASI Alliance directory
      const av = handle.endsWith('.av') ? handle.slice(0, -3) : handle
      out.push(`https://agentverse.ai/agents/${av}`)
    }
    out.push(`https://agents.flockx.io/${agent.id}`)
    return out
  }
}
