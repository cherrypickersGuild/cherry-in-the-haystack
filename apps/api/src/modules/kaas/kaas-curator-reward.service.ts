import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { ethers } from 'ethers';
import { getSharedChainAdapter } from './chain-adapter/shared-adapter';
import type { IChainAdapter } from './chain-adapter';

const REWARD_RATIO = 0.4; // 구매 크레딧의 40%를 큐레이터에게

@Injectable()
export class KaasCuratorRewardService {
  private readonly logger = new Logger(KaasCuratorRewardService.name);
  private chainAdapter: IChainAdapter;

  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {
    try {
      this.chainAdapter = getSharedChainAdapter();
      this.logger.log(`Chain adapter initialized (shared): ${process.env.CHAIN_ADAPTER ?? 'mock'}`);
    } catch (err: any) {
      this.logger.warn(`Chain adapter init failed: ${err.message}. Using mock.`);
      const { MockAdapter } = require('./chain-adapter/mock-adapter');
      this.chainAdapter = new MockAdapter();
    }
  }

  /**
   * 구매/팔로우 발생 시 큐레이터 보상 적립 + 온체인 기록
   * queryLogId: 어떤 구매에서 발생했는지 추적
   */
  async distributeReward(
    conceptId: string,
    queryLogId: string,
    creditsConsumed: number,
  ): Promise<void> {
    const rewardAmount = Math.floor(creditsConsumed * REWARD_RATIO);
    if (rewardAmount <= 0) return;

    // concept의 curator_wallet + 대표 큐레이터(evidence 첫번째) 조회
    const concept = await this.knex('kaas.concept')
      .where({ id: conceptId })
      .select('curator_wallet')
      .first();

    if (!concept) {
      this.logger.warn(`Concept not found for reward: ${conceptId}`);
      return;
    }

    // evidence에서 대표 큐레이터 이름 조회 (Gold 티어 우선)
    const topEvidence = await this.knex('kaas.evidence')
      .where({ concept_id: conceptId })
      .orderByRaw("CASE WHEN curator_tier = 'Gold' THEN 0 ELSE 1 END")
      .select('curator', 'curator_tier')
      .first();

    const curatorName = topEvidence?.curator ?? 'Unknown';
    const rawWallet = concept.curator_wallet ?? process.env.DEPLOYER_ADDRESS ?? '0x0000000000000000000000000000000000000000';
    const curatorWallet = ethers.getAddress(rawWallet.toLowerCase()); // EIP-55 체크섬 정규화

    // DB에 보상 기록 (pending 상태) — 온체인 tx는 Withdraw 시점에만 발생.
    // 구매마다 RPC 호출하지 않고, 큐레이터가 모아서 한 번에 인출할 때 체결.
    await this.knex('kaas.curator_reward').insert({
      concept_id: conceptId,
      query_log_id: queryLogId,
      curator_name: curatorName,
      curator_wallet: curatorWallet,
      amount: rewardAmount,
      withdrawn: false,
      tx_hash: null,
    });

    this.logger.log(`Curator reward accrued (pending): ${curatorName} +${rewardAmount}cr (concept=${conceptId})`);
  }

  /**
   * 큐레이터가 Withdraw 버튼으로 쌓인 보상을 인출.
   * - 해당 큐레이터의 withdrawn=false row 전부 합산
   * - 온체인 withdrawReward(wallet, sum) 호출 → tx_hash 수신
   * - 성공 시 해당 row들을 withdrawn=true + tx_hash 업데이트
   * - 실패 시 row 변경 없이 에러 throw (재시도 가능)
   */
  async withdraw(curatorName: string): Promise<{
    ok: boolean;
    withdrawn: number;
    txHash: string | null;
    onChain: boolean;
    explorerUrl?: string;
    error?: string;
    rowsUpdated: number;
  }> {
    // 1. 미지급 보상 합산
    const pendingRows: Array<{ id: string; amount: number; curator_wallet: string | null }> =
      await this.knex('kaas.curator_reward')
        .where({ curator_name: curatorName, withdrawn: false })
        .select('id', 'amount', 'curator_wallet');

    if (pendingRows.length === 0) {
      return { ok: false, withdrawn: 0, txHash: null, onChain: false, rowsUpdated: 0, error: 'No pending rewards' };
    }

    const totalAmount = pendingRows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const wallet = pendingRows.find((r) => r.curator_wallet)?.curator_wallet
      ?? process.env.DEPLOYER_ADDRESS
      ?? '0x0000000000000000000000000000000000000000';

    // 2. 온체인 트랜잭션
    let txHash: string | null = null;
    let onChain = false;
    let explorerUrl: string | undefined;
    try {
      const result = await this.chainAdapter.withdrawReward(wallet, totalAmount);
      txHash = result.hash;
      onChain = true;
      explorerUrl = (result as any).explorerUrl;
      this.logger.log(`Withdraw on-chain: ${txHash} → ${wallet} (${totalAmount}cr)`);
    } catch (err: any) {
      const errorMsg = err?.message ?? 'On-chain withdraw failed';
      this.logger.error(`Withdraw failed: ${errorMsg}`);
      return { ok: false, withdrawn: 0, txHash: null, onChain: false, rowsUpdated: 0, error: errorMsg };
    }

    // 3. 성공한 경우에만 DB row들 업데이트 (동일 tx_hash로 묶임)
    const chainName = process.env.CHAIN_ADAPTER ?? 'mock';
    const ids = pendingRows.map((r) => r.id);
    const rowsUpdated = await this.knex('kaas.curator_reward')
      .whereIn('id', ids)
      .update({ withdrawn: true, tx_hash: txHash });

    return { ok: true, withdrawn: totalAmount, txHash, onChain, explorerUrl, rowsUpdated };
  }

  /** 큐레이터 이름으로 미지급 보상 잔액 조회 */
  async getBalance(curatorName: string): Promise<{
    curator: string;
    pending: number;
    withdrawn: number;
    total: number;
    rewards: any[];
  }> {
    const rewards = await this.knex('kaas.curator_reward')
      .where({ curator_name: curatorName })
      .orderBy('created_at', 'desc');

    const pending = rewards.filter(r => !r.withdrawn).reduce((s, r) => s + r.amount, 0);
    const withdrawn = rewards.filter(r => r.withdrawn).reduce((s, r) => s + r.amount, 0);

    return { curator: curatorName, pending, withdrawn, total: pending + withdrawn, rewards };
  }

  /** 전체 큐레이터 보상 현황 (Admin용) */
  async getAllRewards(): Promise<any[]> {
    return this.knex('kaas.curator_reward')
      .select(
        'curator_name',
        this.knex.raw("SUM(amount)::int as total"),
        this.knex.raw("SUM(CASE WHEN withdrawn = false THEN amount ELSE 0 END)::int as pending"),
        this.knex.raw("COUNT(*)::int as count"),
      )
      .groupBy('curator_name')
      .orderBy('total', 'desc');
  }
}
