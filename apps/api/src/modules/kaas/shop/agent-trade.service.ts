/**
 * AgentTradeService — list other active agents, diff their installed
 * SKILL.md files against mine, and let me buy a single missing file
 * for a flat 5 credits.
 *
 * Self-report is the only source of truth for "what does this agent have".
 * No DB knowledge fuzzy match, no cache (matches existing patterns).
 */

import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

import { KaasAgentService } from '../kaas-agent.service'
import { KaasCreditService } from '../kaas-credit.service'
import { KaasKnowledgeService } from '../kaas-knowledge.service'
import { KaasProvenanceService } from '../kaas-provenance.service'
import { KaasWsGateway } from '../kaas-ws.gateway'
import {
  cardToSkillFile,
  toSavePayload,
} from '../../bench/cards/serialize'
import type { AgentBuildInput } from '../../bench/cards/compose-runtime'
import {
  AGENT_TRADE_FLAT_PRICE,
  classifySlug,
  type ClassifiedSkill,
} from './skill-classifier'
import type { KarmaTierName } from '../types/kaas.types'

export interface ShopAgent {
  id: string
  name: string
  /** True if the agent is currently connected via cherry-kaas WebSocket.
   *  Offline agents still appear in the list (they're real registrations)
   *  but their diff returns empty until they reconnect. */
  connected: boolean
}

export interface AgentDiff {
  both: ClassifiedSkill[]
  onlyMine: ClassifiedSkill[]
  onlyTheirs: ClassifiedSkill[]
}

export interface BuySkillResponse {
  installed: boolean
  saved_path?: string
  size_bytes?: number
  credits_consumed: number
  credits_after: number
  provenance: {
    hash: string | null
    chain: string
    explorer_url: string | null
    on_chain: boolean
  }
}

const EMPTY_BUILD: AgentBuildInput = {
  prompt: null,
  mcp: null,
  skillA: null,
  skillB: null,
  skillC: null,
  orchestration: null,
  memory: null,
}

@Injectable()
export class AgentTradeService {
  private readonly logger = new Logger(AgentTradeService.name)

  constructor(
    private readonly agents: KaasAgentService,
    private readonly credits: KaasCreditService,
    private readonly catalog: KaasKnowledgeService,
    private readonly ws: KaasWsGateway,
    private readonly provenance: KaasProvenanceService,
  ) {}

  /** Other agents that are **currently connected via WebSocket** (caller
   *  excluded). Offline registrations are intentionally hidden — this tab
   *  is about live trading, not browsing dead records. */
  async listAgents(excludeApiKey?: string): Promise<ShopAgent[]> {
    const all = await this.agents.findAllActive()
    const me = excludeApiKey
      ? await this.agents.findByApiKey(excludeApiKey)
      : null
    return all
      .filter((a) => !me || a.id !== me.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        connected: this.ws.isAgentConnected(a.id),
      }))
  }

  /** Diff my agent vs target agent. Both fetched live; offline → empty list. */
  async diff(targetAgentId: string, myApiKey: string): Promise<AgentDiff> {
    const me = await this.agents.findByApiKey(myApiKey)
    if (!me) {
      throw new HttpException(
        { code: 'AGENT_NOT_FOUND', message: 'Invalid API key' },
        HttpStatus.UNAUTHORIZED,
      )
    }
    const them = await this.agents.findById(targetAgentId)
    if (!them) {
      throw new HttpException(
        { code: 'TARGET_NOT_FOUND', message: 'Target agent not found' },
        HttpStatus.NOT_FOUND,
      )
    }

    const [mine, theirs] = await Promise.all([
      this.fetchSkills(me.id),
      this.fetchSkills(them.id),
    ])
    const mineSet = new Set(mine)
    const theirsSet = new Set(theirs)

    const both = [...mineSet].filter((s) => theirsSet.has(s))
    const onlyMine = [...mineSet].filter((s) => !theirsSet.has(s))
    const onlyTheirs = [...theirsSet].filter((s) => !mineSet.has(s))

    return {
      both: await this.classifyAll(both),
      onlyMine: await this.classifyAll(onlyMine),
      onlyTheirs: await this.classifyAll(onlyTheirs),
    }
  }

  /** Charge 5cr and install a single SKILL.md to the caller's agent.
   *  Supports concept (UUID) and Workshop card slugs. */
  async buySingle(slug: string, myApiKey: string): Promise<BuySkillResponse> {
    const me = await this.agents.findByApiKey(myApiKey)
    if (!me) {
      throw new HttpException(
        { code: 'AGENT_NOT_FOUND' },
        HttpStatus.UNAUTHORIZED,
      )
    }
    if (!this.ws.isAgentConnected(me.id)) {
      throw new HttpException(
        { code: 'AGENT_OFFLINE', message: 'Your agent is not connected.' },
        HttpStatus.CONFLICT,
      )
    }

    const classified = classifySlug(slug)
    if (classified.kind === 'meta' || classified.kind === 'unknown') {
      throw new HttpException(
        {
          code: 'NOT_BUYABLE',
          message: `This file (${slug}) cannot be purchased individually.`,
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    // Build the SKILL.md payload BEFORE charging credits so a malformed slug
    // can't burn the user's balance.
    const payload = await this.buildSavePayload(classified)
    if (!payload) {
      throw new HttpException(
        {
          code: 'CONTENT_UNAVAILABLE',
          message: `Source content for ${slug} is missing.`,
        },
        HttpStatus.NOT_FOUND,
      )
    }

    const consumed = await this.credits.consume(
      me.id,
      AGENT_TRADE_FLAT_PRICE,
      (me.karma_tier as KarmaTierName) ?? 'Bronze',
      slug,
      'agent-trade',
    )

    let installed = false
    let savedPath: string | undefined
    let sizeBytes: number | undefined
    try {
      const ack = await this.ws.requestSaveSkill(me.id, payload)
      installed = true
      savedPath = ack.saved_path
      sizeBytes = ack.size_bytes
    } catch (err) {
      // Refund — install failed, user shouldn't pay.
      await this.credits.refundDbOnly(
        me.id,
        consumed.consumed,
        `agent-trade-failed:${slug}`,
      )
      const msg = err instanceof Error ? err.message : String(err)
      throw new HttpException(
        { code: 'INSTALL_FAILED', message: msg },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }

    const prov = await this.provenance.recordQuery(
      me.id,
      slug,
      'agent-trade',
      consumed.consumed,
      { slug, saved_path: savedPath, size_bytes: sizeBytes },
    )

    const { balance: creditsAfter } = await this.credits.getBalance(me.id)

    return {
      installed,
      saved_path: savedPath,
      size_bytes: sizeBytes,
      credits_consumed: consumed.consumed,
      credits_after: creditsAfter,
      provenance: {
        hash: prov.provenanceHash,
        chain: prov.onChain ? (process.env.CHAIN_ADAPTER ?? 'mock') : 'failed',
        explorer_url: prov.explorerUrl,
        on_chain: prov.onChain,
      },
    }
  }

  // ── helpers ─────────────────────────────────────────────────────

  private async fetchSkills(agentId: string): Promise<string[]> {
    if (!this.ws.isAgentConnected(agentId)) return []
    try {
      const r: any = await this.ws.requestSelfReport(agentId)
      const items: any[] = r?.local_skills?.items ?? r?.report?.local_skills?.items ?? []
      return items
        .filter((it) => it?.hasSkillMd)
        .map((it) => {
          const folder = String(it.dir ?? '').split(/[\\/]/).filter(Boolean).pop() ?? ''
          return folder
        })
        .filter((f) => f.startsWith('cherry-'))
        .map((f) => f.slice('cherry-'.length))
    } catch (err) {
      this.logger.warn(
        `[agent-trade] self-report failed for ${agentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      return []
    }
  }

  private async classifyAll(slugs: string[]): Promise<ClassifiedSkill[]> {
    const out: ClassifiedSkill[] = []
    for (const slug of slugs) {
      const c = classifySlug(slug)
      if (c.kind === 'concept') {
        const concept = await this.catalog.findById(c.slug).catch(() => null)
        if (concept) {
          c.title = concept.title
          c.summary = concept.summary ?? ''
        }
      }
      out.push(c)
    }
    return out
  }

  /** Build a save_skill payload for either a concept or a Workshop card. */
  private async buildSavePayload(c: ClassifiedSkill) {
    if (c.kind === 'concept') {
      const concept = await this.catalog.findByIdWithContent(c.slug)
      if (!concept || !concept.contentMd) return null
      const dir = `~/.claude/skills/cherry-${c.slug}`
      return {
        request_id: uuidv4(),
        concept_id: c.slug,
        title: concept.title,
        summary: concept.summary ?? '',
        content_md: concept.contentMd,
        target_dir: dir,
        target_file: `${dir}/SKILL.md`,
      }
    }
    if (c.kind === 'card') {
      // Workshop folder slug is `p-hunter`/`s-json-strict`/etc — the actual
      // card id in CARD_REGISTRY is `inv-p-hunter`/`inv-s-json-strict`.
      const cardId = `inv-${c.slug}`
      // Map type prefix → slot the serializer accepts.
      const prefix = c.slug.match(/^([a-z]+)-/)?.[1] ?? ''
      const slot =
        prefix === 'p'  ? 'prompt'
      : prefix === 's'  ? 'skillA'
      : prefix === 'm'  ? 'mcp'
      : prefix === 'o'  ? 'orchestration'
      : prefix === 'me' ? 'memory'
      : null
      if (!slot) return null
      const ctx = {
        buildId: 'agent-trade',
        buildName: 'Agent Trade purchase',
        agentId: '',
        installedAt: new Date().toISOString(),
        runId: uuidv4().slice(0, 8),
      }
      const file = cardToSkillFile(slot as any, cardId, EMPTY_BUILD, ctx)
      if (!file) return null
      return toSavePayload(file, () => uuidv4())
    }
    return null
  }
}
