import { Inject, Injectable, Logger, HttpException } from '@nestjs/common';
import { Knex } from 'knex';
import { KARMA_DISCOUNT, KarmaTierName } from './types/kaas.types';
import { getSharedChainAdapter, getChainAdapter, type ChainName } from './chain-adapter/shared-adapter';
import type { IChainAdapter } from './chain-adapter';

@Injectable()
export class KaasCreditService {
  private readonly logger = new Logger(KaasCreditService.name);
  private chainAdapter: IChainAdapter;

  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {
    try {
      this.chainAdapter = getSharedChainAdapter();
    } catch (err: any) {
      this.logger.warn(`Chain adapter init failed: ${err.message}. Using mock.`);
      const { MockAdapter } = require('./chain-adapter/mock-adapter');
      this.chainAdapter = new MockAdapter();
    }
  }

  /** 잔액 조회 (ledger SUM) */
  async getBalance(agentId: string): Promise<{ balance: number; totalDeposited: number; totalConsumed: number }> {
    const rows = await this.knex('kaas.credit_ledger')
      .where({ agent_id: agentId })
      .select(
        this.knex.raw("COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE 0 END), 0)::int as deposited"),
        this.knex.raw("COALESCE(SUM(CASE WHEN type='consume' THEN ABS(amount) ELSE 0 END), 0)::int as consumed"),
      );
    const { deposited, consumed } = rows[0];
    return { balance: deposited - consumed, totalDeposited: deposited, totalConsumed: consumed };
  }

  /** 크레딧 차감 (Karma 할인 + SALE 할인 적용 — 곱연산으로 스택) + 온체인 기록 */
  async consume(
    agentId: string,
    baseAmount: number,
    karmaTier: KarmaTierName,
    conceptId: string,
    actionType: string,
    opts?: { saleDiscount?: number },
  ): Promise<{ consumed: number; remaining: number; txHash: string | null; onChain: boolean }> {
    const karmaDiscount = KARMA_DISCOUNT[karmaTier] ?? 0;
    const saleDiscount = opts?.saleDiscount ?? 0;
    // 할인 중첩 — 예: Karma 15% + SALE 20% → 0.85 × 0.80 = 0.68, 32% off
    const finalAmount = Math.round(baseAmount * (1 - karmaDiscount) * (1 - saleDiscount));

    const { balance } = await this.getBalance(agentId);
    if (balance < finalAmount) {
      throw new HttpException({
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits',
        credits_required: finalAmount,
        credits_available: balance,
      }, 402);
    }

    // 에이전트 wallet 조회
    const [agentRow] = await this.knex('kaas.agent').where({ id: agentId }).select('wallet_address');
    const wallet = agentRow?.wallet_address ?? '';

    // 1. 온체인 consumeCredit 트랜잭션 (실패해도 DB 차감은 유지)
    let txHash: string | null = null;
    let onChain = false;
    try {
      const result = await this.chainAdapter.consumeCredit(wallet, finalAmount, conceptId, actionType);
      txHash = result.hash;
      onChain = true;
      this.logger.log(`Consume on-chain: ${txHash} (${wallet} -${finalAmount}cr, ${actionType}:${conceptId})`);
    } catch (err: any) {
      this.logger.warn(`Consume on-chain failed (DB 차감 유지): ${err?.message}`);
    }

    // 2. DB 차감
    await this.knex('kaas.credit_ledger').insert({
      agent_id: agentId,
      amount: -finalAmount,
      type: 'consume',
      description: `${actionType}: ${conceptId}`,
      tx_hash: txHash,
      chain: onChain ? (process.env.CHAIN_ADAPTER ?? 'mock') : 'failed',
    });

    const remaining = balance - finalAmount;
    this.logger.log(`Credit consumed: agent=${agentId}, amount=${finalAmount}, remaining=${remaining}`);
    return { consumed: finalAmount, remaining, txHash, onChain };
  }

  /**
   * 유저 지갑이 이미 직접 서명한 경우 — 온체인 호출 생략, DB 차감만 수행.
   * NEAR(또는 향후 다른 유저-직접-서명 체인)에서 사용.
   *
   * - Karma/Sale 할인 계산 로직은 consume()과 동일
   * - 잔액 부족 시 402 예외
   * - preSignedTxHash는 그대로 credit_ledger.tx_hash에 저장 (explorer 링크 구성용)
   * - chain은 'near' 등 유저가 지정한 체인명 그대로
   */
  async consumeDbOnly(
    agentId: string,
    baseAmount: number,
    karmaTier: KarmaTierName,
    conceptId: string,
    actionType: string,
    opts: { saleDiscount?: number; preSignedTxHash: string; chain: ChainName },
  ): Promise<{ consumed: number; remaining: number; txHash: string; onChain: true }> {
    const karmaDiscount = KARMA_DISCOUNT[karmaTier] ?? 0;
    const saleDiscount = opts.saleDiscount ?? 0;
    const finalAmount = Math.round(baseAmount * (1 - karmaDiscount) * (1 - saleDiscount));

    const { balance } = await this.getBalance(agentId);
    if (balance < finalAmount) {
      throw new HttpException({
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits',
        credits_required: finalAmount,
        credits_available: balance,
      }, 402);
    }

    await this.knex('kaas.credit_ledger').insert({
      agent_id: agentId,
      amount: -finalAmount,
      type: 'consume',
      description: `${actionType}: ${conceptId}`,
      tx_hash: opts.preSignedTxHash,
      chain: opts.chain,
    });

    const remaining = balance - finalAmount;
    this.logger.log(
      `Credit consumed (pre-signed/${opts.chain}): agent=${agentId}, amount=${finalAmount}, remaining=${remaining}, tx=${opts.preSignedTxHash}`,
    );
    return { consumed: finalAmount, remaining, txHash: opts.preSignedTxHash, onChain: true };
  }

  /** Ledger 내역 조회 (deposit + consume 모두) */
  async getLedger(agentId: string, limit = 50): Promise<any[]> {
    return this.knex('kaas.credit_ledger')
      .where({ agent_id: agentId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select('id', 'amount', 'type', 'description', 'tx_hash', 'chain', 'created_at');
  }

  /** 크레딧 DB만 적립 (온체인 없이 즉시) — 가입 축하 크레딧 등 */
  async depositDbOnly(agentId: string, amount: number): Promise<{ balance: number }> {
    await this.knex('kaas.credit_ledger').insert({
      agent_id: agentId,
      amount,
      type: 'deposit',
      description: 'Welcome bonus',
      tx_hash: null,
      chain: null,
    });
    const { balance } = await this.getBalance(agentId);
    this.logger.log(`Welcome deposit: agent=${agentId}, amount=${amount}, balance=${balance}`);
    return { balance };
  }

  /** 크레딧 충전 — 온체인 트랜잭션 생성 후 DB 적립.
   *  온체인 실패해도 DB 적립은 유지 (구매 플로우와 동일). tx_hash NULL + chain='failed'. */
  async deposit(
    agentId: string,
    amount: number,
    chain?: ChainName,
  ): Promise<{ balance: number; txHash: string | null; onChain: boolean; explorerUrl?: string; error?: string }> {
    // 에이전트 wallet 조회
    const [agentRow] = await this.knex('kaas.agent').where({ id: agentId }).select('wallet_address');
    const wallet = agentRow?.wallet_address ?? '';

    // 1. 온체인 트랜잭션
    let txHash: string | null = null;
    let onChain = false;
    let explorerUrl: string | undefined;
    let errorMsg: string | undefined;
    try {
      const adapter = chain ? getChainAdapter(chain) : this.chainAdapter;
      const result = await adapter.depositCredit(wallet, amount);
      txHash = result.hash;
      onChain = true;
      explorerUrl = (result as any).explorerUrl;
      this.logger.log(`Deposit on-chain: ${txHash} (${wallet} +${amount})`);
    } catch (err: any) {
      errorMsg = err?.message ?? 'Unknown on-chain error';
      this.logger.warn(`Deposit on-chain failed (DB 적립 유지): ${errorMsg}`);
    }

    // 2. DB 적립
    await this.knex('kaas.credit_ledger').insert({
      agent_id: agentId,
      amount,
      type: 'deposit',
      description: 'Credit deposit',
      tx_hash: txHash,
      chain: onChain ? (chain ?? process.env.CHAIN_ADAPTER ?? 'mock') : 'failed',
    });

    const { balance } = await this.getBalance(agentId);
    this.logger.log(`Credit deposited: agent=${agentId}, amount=${amount}, balance=${balance}`);
    return { balance, txHash, onChain, explorerUrl, error: errorMsg };
  }
}
