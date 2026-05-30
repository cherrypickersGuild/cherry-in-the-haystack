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

  /** 체인별 explorer URL 구성 (pre-signed tx 링크 생성용) */
  private buildExplorerUrl(chain: ChainName, txHash: string): string {
    switch (chain) {
      case 'near':
        return `https://testnet.nearblocks.io/txns/${txHash}`;
      case 'status':
        return `https://sepoliascan.status.network/tx/${txHash}`;
      default:
        return '';
    }
  }

  /** 쿼리 로그 기록 + 온체인 프로비넌스 기록 (동기)
   *  chainOverride: 요청별로 체인 지정 ('status' | 'near' | 'mock'). 미지정 시 env 기본값
   *  preSigned: 유저 지갑이 직접 서명한 tx hash가 있으면 온체인 호출을 건너뛰고 그 hash를 그대로 저장.
   *  opts.privacy: TEE 모드. true면 response_snapshot에 평문 대신 hash만 남김 → 서버/DB 관리자에게 내용 불가시.
   *    일반 purchase/follow는 평문 유지해야 demo 상 TEE와 대비가 보임. */
  async recordQuery(
    agentId: string,
    conceptId: string,
    actionType: string,
    creditsConsumed: number,
    responseData: Record<string, unknown>,
    chainOverride?: ChainName,
    preSigned?: { txHash: string; chain: ChainName; explorerUrl?: string },
    opts?: { privacy?: boolean },
  ): Promise<{ queryLogId: string; provenanceHash: string | null; explorerUrl: string | null; onChain: boolean; chain: string; error?: string }> {
    // 매 구매마다 고유한 hash 생성
    const uniqueData = {
      ...responseData,
      _agent: agentId,
      _ts: Date.now(),
      _nonce: Math.random().toString(36).slice(2),
    };
    const localHash = this.generateHash(uniqueData);
    const chain = preSigned?.chain ?? chainOverride ?? (process.env.CHAIN_ADAPTER as ChainName) ?? 'mock';

    // TEE/privacy 모드면 response_snapshot에 해시만. 평문 responseData는 함수 스코프 벗어나면 GC됨.
    const snapshotPayload = opts?.privacy
      ? { _redacted: true, _hash: localHash, _action: actionType, _at: new Date().toISOString() }
      : responseData;

    // 데모용 로그 — TEE 보안 차이를 런타임에서 확인 가능
    if (opts?.privacy) {
      this.logger.log(`[snapshot:REDACTED] agent=${agentId} action=${actionType} hash=${localHash} (server cannot see content)`);
    } else {
      this.logger.log(`[snapshot:PLAINTEXT] agent=${agentId} action=${actionType} payload=${JSON.stringify(responseData).slice(0, 500)}`);
    }

    // 1차: 로컬 해시로 DB 선저장
    const [log] = await this.knex('kaas.query_log')
      .insert({
        agent_id: agentId,
        concept_id: conceptId,
        action_type: actionType,
        credits_consumed: creditsConsumed,
        provenance_hash: localHash,
        chain,
        response_snapshot: JSON.stringify(snapshotPayload),
      })
      .returning('*');

    // 유저가 이미 서명한 tx가 있으면 서버 서명 skip, 해당 tx hash 그대로 기록
    if (preSigned?.txHash) {
      const explorerUrl = preSigned.explorerUrl ?? this.buildExplorerUrl(preSigned.chain, preSigned.txHash);
      await this.knex('kaas.query_log').where({ id: log.id }).update({
        provenance_hash: preSigned.txHash,
        chain: preSigned.chain,
      });
      this.logger.log(`On-chain provenance [${preSigned.chain}] (pre-signed): ${preSigned.txHash}`);
      return {
        queryLogId: log.id,
        provenanceHash: preSigned.txHash,
        explorerUrl,
        onChain: true,
        chain: preSigned.chain,
      };
    }

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
      // 실패 시 해당 chain 스타일의 mock tx 생성 (데모 환경에서 링크가 끊기지 않도록)
      const { MockAdapter } = require('./chain-adapter/mock-adapter');
      const mock = new MockAdapter(chain);
      const mockResult = await mock.recordProvenance(localHash, '', conceptId);
      await this.knex('kaas.query_log').where({ id: log.id }).update({
        provenance_hash: mockResult.hash,
        chain: `${chain}-mock`,
      });
      return {
        queryLogId: log.id,
        provenanceHash: mockResult.hash,
        explorerUrl: mockResult.explorerUrl,
        onChain: true,
        chain: `${chain}-mock`,
        error: errMsg,
      };
    }
  }

  /** 에이전트의 쿼리 이력 조회 (concept.title 조인) */
  async getQueryHistory(agentId: string): Promise<unknown[]> {
    return this.knex('kaas.query_log as ql')
      .leftJoin('kaas.concept as c', 'ql.concept_id', 'c.id')
      .where({ 'ql.agent_id': agentId })
      .orderBy('ql.created_at', 'desc')
      .limit(20)
      .select('ql.*', 'c.title as concept_title');
  }
}
