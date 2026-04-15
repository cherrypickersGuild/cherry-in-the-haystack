import { Inject, Injectable, Logger, HttpException } from '@nestjs/common';
import { Knex } from 'knex';
import { KARMA_DISCOUNT, KarmaTierName } from './types/kaas.types';

@Injectable()
export class KaasCreditService {
  private readonly logger = new Logger(KaasCreditService.name);

  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

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

  /** 크레딧 차감 (Karma 할인 적용) */
  async consume(
    agentId: string,
    baseAmount: number,
    karmaTier: KarmaTierName,
    conceptId: string,
    actionType: string,
  ): Promise<{ consumed: number; remaining: number }> {
    const discount = KARMA_DISCOUNT[karmaTier] ?? 0;
    const finalAmount = Math.round(baseAmount * (1 - discount));

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
    });

    const remaining = balance - finalAmount;
    this.logger.log(`Credit consumed: agent=${agentId}, amount=${finalAmount}, remaining=${remaining}`);
    return { consumed: finalAmount, remaining };
  }

  /** Ledger 내역 조회 (deposit + consume 모두) */
  async getLedger(agentId: string, limit = 50): Promise<any[]> {
    return this.knex('kaas.credit_ledger')
      .where({ agent_id: agentId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select('id', 'amount', 'type', 'description', 'tx_hash', 'chain', 'created_at');
  }

  /** 크레딧 충전 */
  async deposit(
    agentId: string,
    amount: number,
    txHash?: string,
    chain?: string,
  ): Promise<{ balance: number; txHash?: string }> {
    await this.knex('kaas.credit_ledger').insert({
      agent_id: agentId,
      amount,
      type: 'deposit',
      description: 'Credit deposit',
      tx_hash: txHash ?? null,
      chain: chain ?? null,
    });

    const { balance } = await this.getBalance(agentId);
    this.logger.log(`Credit deposited: agent=${agentId}, amount=${amount}, balance=${balance}`);
    return { balance, txHash };
  }
}
