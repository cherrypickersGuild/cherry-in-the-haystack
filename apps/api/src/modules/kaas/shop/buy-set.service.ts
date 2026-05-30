/**
 * BuySetService — wraps InstallBuildService in a credit + provenance layer.
 *
 * Flow:
 *   1. Resolve set + agent + connectivity
 *   2. Check balance → 402 if insufficient
 *   3. Consume credits (creates ledger row + optional on-chain tx)
 *   4. Install the set's canonical Workshop build via InstallBuildService
 *   5. If install partially failed OR threw — refund full credits
 *   6. Return install result + receipt + provenance
 *
 * Note on atomicity: `consume()` writes its ledger row inside its own
 * transaction and returns. If InstallBuildService throws we compensate
 * with `refundDbOnly()` (a deposit-typed ledger row). This is simpler than
 * a true two-phase transaction and good enough for demo scope.
 */

import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'

import { KaasAgentService } from '../kaas-agent.service'
import { KaasCreditService } from '../kaas-credit.service'
import { KaasWsGateway } from '../kaas-ws.gateway'
import {
  InstallBuildService,
  type InstallBuildResponse,
} from '../install-build.service'
import type { KarmaTierName } from '../types/kaas.types'

import { resolveShopSet } from './shop-sets.registry'

export interface BuySetResponse extends InstallBuildResponse {
  credits_consumed: number
  credits_after: number
  provenance: {
    hash: string | null
    chain: string
    explorer_url: string | null
    on_chain: boolean
  }
  partial: boolean
}

@Injectable()
export class BuySetService {
  private readonly logger = new Logger(BuySetService.name)

  constructor(
    private readonly agents: KaasAgentService,
    private readonly credits: KaasCreditService,
    private readonly ws: KaasWsGateway,
    private readonly install: InstallBuildService,
  ) {}

  async execute(
    setId: string,
    apiKey: string,
    chain: 'status' | 'near' | 'mock',
  ): Promise<BuySetResponse> {
    // Gate 1 — set exists
    const set = resolveShopSet(setId)
    if (!set) {
      throw new HttpException(
        { code: 'SET_NOT_FOUND', message: `Unknown set: ${setId}` },
        HttpStatus.NOT_FOUND,
      )
    }

    // Gate 2 — agent + ownership
    const agent = await this.agents.findByApiKey(apiKey)
    if (!agent) {
      throw new HttpException(
        { code: 'AGENT_NOT_FOUND', message: 'Invalid API key' },
        HttpStatus.UNAUTHORIZED,
      )
    }

    // Gate 3 — MCP connection (avoid paying for an un-reachable agent)
    if (!this.ws.isAgentConnected(agent.id)) {
      throw new HttpException(
        {
          code: 'AGENT_OFFLINE',
          message:
            "Agent not connected. Run 'claude' with the cherry-kaas MCP registered.",
        },
        HttpStatus.CONFLICT,
      )
    }

    // Gate 4 — credit consumption (throws 402 on insufficient balance)
    const consumed = await this.credits.consume(
      agent.id,
      set.priceBundled,
      (agent.karma_tier as KarmaTierName) ?? 'Bronze',
      set.id,
      'purchase-set',
    )

    // Install. On failure we refund the credits we just consumed.
    let installResult: InstallBuildResponse
    try {
      installResult = await this.install.install(agent.user_id, agent.id, {
        build_id: set.id,
        build_name: set.title,
        equipped: set.equipped,
      })
    } catch (err) {
      await this.credits.refundDbOnly(
        agent.id,
        consumed.consumed,
        `install-failed:${setId}`,
      )
      this.logger.error(
        `[buy-set] install threw — refunded ${consumed.consumed}cr. agent=${agent.id.slice(0, 8)} set=${setId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      throw err instanceof HttpException
        ? err
        : new HttpException(
            {
              code: 'INSTALL_FAILED',
              message: err instanceof Error ? err.message : String(err),
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          )
    }

    // Partial failure = refund everything (D9). The already-saved SKILL.md
    // files stay on disk; next install overwrites them.
    const partial = installResult.failed.length > 0
    let creditsConsumedFinal = consumed.consumed
    if (partial) {
      await this.credits.refundDbOnly(
        agent.id,
        consumed.consumed,
        `partial-install:${setId}`,
      )
      creditsConsumedFinal = 0
      this.logger.warn(
        `[buy-set] partial install — refunded ${consumed.consumed}cr. failed=${installResult.failed.length}`,
      )
    }

    const { balance: creditsAfter } = await this.credits.getBalance(agent.id)

    return {
      ...installResult,
      credits_consumed: creditsConsumedFinal,
      credits_after: creditsAfter,
      provenance: {
        hash: consumed.txHash ?? null,
        chain,
        explorer_url: this.explorerFor(chain, consumed.txHash),
        on_chain: consumed.onChain,
      },
      partial,
    }
  }

  /** Map chain + tx to the right block explorer URL. */
  private explorerFor(chain: string, txHash: string | null): string | null {
    if (!txHash) return null
    switch (chain) {
      case 'near':
        return `https://testnet.nearblocks.io/txns/${txHash}`
      case 'status-hoodi':
        return `https://hoodiscan.status.network/tx/${txHash}`
      case 'status':
        return `https://sepoliascan.status.network/tx/${txHash}`
      default:
        return null
    }
  }
}
