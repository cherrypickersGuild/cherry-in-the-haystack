import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { createHash } from 'crypto';
import { getSharedChainAdapter, getChainAdapter, type ChainName } from './chain-adapter/shared-adapter';
import type { IChainAdapter } from './chain-adapter';

@Injectable()
export class KaasProvenanceService {
  private readonly logger = new Logger(KaasProvenanceService.name);
  private chainAdapter: IChainAdapter;

  constructor(
    @Inject('KNEX_CONNECTION') private readonly knex: Knex,
  ) {
    try {
      this.chainAdapter = getSharedChainAdapter();
      this.logger.log(`Chain adapter initialized (shared): ${process.env.CHAIN_ADAPTER ?? 'mock'}`);
    } catch (err: any) {
      this.logger.warn(`Chain adapter init failed: ${err.message}. Using mock.`);
      const { MockAdapter } = require('./chain-adapter/mock-adapter');
      this.chainAdapter = new MockAdapter();
    }
  }

  /** 프로비넌스 해시 생성 (응답 내용의 SHA256) */
  generateHash(data: Record<string, unknown>): string {
    return '0x' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /** 쿼리 로그 기록 + 온체인 프로비넌스 기록 (동기)
   *  chainOverride: 요청별로 체인 지정 ('status' | 'near' | 'mock'). 미지정 시 env 기본값 */
  async recordQuery(
    agentId: string,
    conceptId: string,
    actionType: string,
    creditsConsumed: number,
    responseData: Record<string, unknown>,
    chainOverride?: ChainName,
  ): Promise<{ queryLogId: string; provenanceHash: string | null; explorerUrl: string | null; onChain: boolean; chain: string; error?: string }> {
    // 매 구매마다 고유한 hash 생성
    const uniqueData = {
      ...responseData,
      _agent: agentId,
      _ts: Date.now(),
      _nonce: Math.random().toString(36).slice(2),
    };
    const localHash = this.generateHash(uniqueData);
    const chain = chainOverride ?? (process.env.CHAIN_ADAPTER as ChainName) ?? 'mock';

    // 1차: 로컬 해시로 DB 선저장
    const [log] = await this.knex('kaas.query_log')
      .insert({
        agent_id: agentId,
        concept_id: conceptId,
        action_type: actionType,
        credits_consumed: creditsConsumed,
        provenance_hash: localHash,
        chain,
        response_snapshot: JSON.stringify(responseData),
      })
      .returning('*');

    // 체인별 어댑터 선택 (runtime override 지원)
    const adapter = chainOverride ? getChainAdapter(chainOverride) : this.chainAdapter;

    // 2차: 온체인 기록 (동기 — 실제 tx hash를 응답에 포함)
    try {
      const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
      // NEAR는 계정ID, Status는 지갑 주소. fallback 처리
      const walletAddress = agent?.wallet_address ?? agent?.name ?? '0x0000000000000000000000000000000000000000';

      const result = await adapter.recordProvenance(localHash, walletAddress, conceptId);

      // 실제 tx hash로 DB 업데이트
      await this.knex('kaas.query_log').where({ id: log.id }).update({
        provenance_hash: result.hash,
        chain: result.chain,
      });

      this.logger.log(`On-chain provenance [${result.chain}]: ${result.hash} (${result.explorerUrl})`);
      return { queryLogId: log.id, provenanceHash: result.hash, explorerUrl: result.explorerUrl, onChain: true, chain: result.chain };
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      this.logger.warn(`On-chain recording failed [${chain}]: ${errMsg} | code=${err?.code} | cause=${err?.cause?.message}`);
      await this.knex('kaas.query_log').where({ id: log.id }).update({
        provenance_hash: null,
        chain: 'failed',
      });
      return { queryLogId: log.id, provenanceHash: null, explorerUrl: null, onChain: false, chain: 'failed', error: errMsg };
    }
  }

  /** 에이전트의 쿼리 이력 조회 */
  async getQueryHistory(agentId: string): Promise<unknown[]> {
    return this.knex('kaas.query_log')
      .where({ agent_id: agentId })
      .orderBy('created_at', 'desc')
      .limit(20);
  }
}
