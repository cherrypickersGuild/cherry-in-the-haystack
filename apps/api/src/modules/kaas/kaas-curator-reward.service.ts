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

    // DB에 보상 기록
    const [reward] = await this.knex('kaas.curator_reward').insert({
      concept_id: conceptId,
      query_log_id: queryLogId,
      curator_name: curatorName,
      curator_wallet: curatorWallet,
      amount: rewardAmount,
      withdrawn: false,
    }).returning('*');

    this.logger.log(`Curator reward recorded: ${curatorName} +${rewardAmount}cr (concept=${conceptId})`);

    // 온체인 기록 (비동기 — 실패해도 DB 적립은 유지)
    this.recordRewardOnChain(reward.id, curatorWallet, rewardAmount, conceptId).catch((err) => {
      this.logger.warn(`On-chain reward recording failed: ${err.message}`);
    });
  }

  private async recordRewardOnChain(
    rewardId: string,
    curatorWallet: string,
    amount: number,
    conceptId: string,
  ): Promise<void> {
    const result = await this.chainAdapter.withdrawReward(curatorWallet, amount);
    await this.knex('kaas.curator_reward').where({ id: rewardId }).update({
      tx_hash: result.hash,
    });
    this.logger.log(`On-chain reward: ${result.hash} → ${curatorWallet} (${amount}cr)`);
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
