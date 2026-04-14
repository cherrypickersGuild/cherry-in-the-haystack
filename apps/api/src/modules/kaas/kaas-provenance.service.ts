import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { createHash } from 'crypto';
import { getSharedChainAdapter } from './chain-adapter/shared-adapter';
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

  /** 쿼리 로그 기록 + 온체인 프로비넌스 기록 (동기) */
  async recordQuery(
    agentId: string,
    conceptId: string,
    actionType: string,
    creditsConsumed: number,
    responseData: Record<string, unknown>,
  ): Promise<{ queryLogId: string; provenanceHash: string | null; explorerUrl: string | null; onChain: boolean; error?: string }> {
    // 매 구매마다 고유한 hash 생성: 응답 데이터 + agent + timestamp + random nonce
    // (같은 에이전트가 같은 컨셉을 재구매해도 온체인 중복 기록 방지 로직에 걸리지 않도록)
    const uniqueData = {
      ...responseData,
      _agent: agentId,
      _ts: Date.now(),
      _nonce: Math.random().toString(36).slice(2),
    };
    const localHash = this.generateHash(uniqueData);
    const chain = process.env.CHAIN_ADAPTER ?? 'mock';

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

    // 2차: 온체인 기록 (동기 — 실제 tx hash를 응답에 포함)
    try {
      const agent = await this.knex('kaas.agent').where({ id: agentId }).first();
      const walletAddress = agent?.wallet_address ?? '0x0000000000000000000000000000000000000000';

      const result = await this.chainAdapter.recordProvenance(localHash, walletAddress, conceptId);

      // 실제 tx hash로 DB 업데이트
      await this.knex('kaas.query_log').where({ id: log.id }).update({
        provenance_hash: result.hash,
        chain: result.chain,
      });

      this.logger.log(`On-chain provenance: ${result.hash} (${result.explorerUrl})`);
      return { queryLogId: log.id, provenanceHash: result.hash, explorerUrl: result.explorerUrl, onChain: true };
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      this.logger.warn(`On-chain recording failed: ${errMsg} | code=${err?.code} | cause=${err?.cause?.message}`);
      // 실패 시 온체인 tx 없음 — 가짜 hash/URL 반환 안 함
      await this.knex('kaas.query_log').where({ id: log.id }).update({
        provenance_hash: null,
        chain: 'failed',
      });
      return { queryLogId: log.id, provenanceHash: null, explorerUrl: null, onChain: false, error: errMsg };
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
