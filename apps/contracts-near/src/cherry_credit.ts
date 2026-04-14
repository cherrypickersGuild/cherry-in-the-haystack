// SPDX-License-Identifier: MIT
// Cherry KaaS — CherryCredit contract for NEAR Testnet
// Ports the Solidity CherryCredit.sol to near-sdk-js

import { NearBindgen, near, call, view, initialize, LookupMap } from "near-sdk-js";

@NearBindgen({})
class CherryCredit {
  owner: string = "";
  authorizedServer: string = "";
  // agent accountId → credits
  credits: LookupMap<bigint> = new LookupMap<bigint>("c");
  // curator accountId → rewards
  rewards: LookupMap<bigint> = new LookupMap<bigint>("r");
  // provenance hash → true (existence)
  provenanceExists: LookupMap<boolean> = new LookupMap<boolean>("p");

  @initialize({})
  init({ authorized_server }: { authorized_server: string }) {
    this.owner = near.signerAccountId();
    this.authorizedServer = authorized_server;
  }

  private onlyAuthorized() {
    const caller = near.predecessorAccountId();
    if (caller !== this.owner && caller !== this.authorizedServer) {
      throw new Error(`Not authorized: ${caller}`);
    }
  }

  /** 에이전트 크레딧 충전 */
  @call({})
  deposit({ agent, amount }: { agent: string; amount: string }): { newBalance: string } {
    this.onlyAuthorized();
    const amt = BigInt(amount);
    if (amt <= 0n) throw new Error("Amount must be > 0");
    const current = this.credits.get(agent) ?? 0n;
    const next = BigInt(current as any) + amt;
    this.credits.set(agent, next);
    near.log(`CreditDeposited: ${agent} +${amt} → ${next}`);
    return { newBalance: next.toString() };
  }

  /** 지식 구매/팔로우 시 크레딧 차감 */
  @call({})
  consumeCredit({
    agent,
    amount,
    conceptId,
    actionType,
  }: {
    agent: string;
    amount: string;
    conceptId: string;
    actionType: string;
  }): { remainingBalance: string } {
    this.onlyAuthorized();
    const amt = BigInt(amount);
    const current = BigInt((this.credits.get(agent) ?? 0n) as any);
    if (current < amt) throw new Error("Insufficient credits");
    const next = current - amt;
    this.credits.set(agent, next);
    near.log(`CreditConsumed: ${agent} -${amt} (${conceptId}/${actionType}) → ${next}`);
    return { remainingBalance: next.toString() };
  }

  /** 큐레이터 보상 분배 (40%) */
  @call({})
  distributeReward({
    curator,
    amount,
    conceptId,
  }: {
    curator: string;
    amount: string;
    conceptId: string;
  }): { newRewardBalance: string } {
    this.onlyAuthorized();
    const amt = BigInt(amount);
    if (amt <= 0n) throw new Error("Amount must be > 0");
    const current = BigInt((this.rewards.get(curator) ?? 0n) as any);
    const next = current + amt;
    this.rewards.set(curator, next);
    near.log(`RewardDistributed: ${curator} +${amt} (${conceptId}) → ${next}`);
    return { newRewardBalance: next.toString() };
  }

  /** 프로비넌스(구매 영수증) 온체인 기록 */
  @call({})
  recordProvenance({
    hash,
    agent,
    conceptId,
  }: {
    hash: string;
    agent: string;
    conceptId: string;
  }): { recorded: boolean } {
    // 누구나 호출 가능하되 한 번만 기록됨
    if (this.provenanceExists.get(hash)) {
      throw new Error("Provenance already recorded");
    }
    this.provenanceExists.set(hash, true);
    near.log(`ProvenanceRecorded: hash=${hash} agent=${agent} concept=${conceptId} ts=${near.blockTimestamp().toString()}`);
    return { recorded: true };
  }

  // ═══════════ View functions ═══════════

  @view({})
  getCredits({ agent }: { agent: string }): string {
    return ((this.credits.get(agent) ?? 0n) as any).toString();
  }

  @view({})
  getRewards({ curator }: { curator: string }): string {
    return ((this.rewards.get(curator) ?? 0n) as any).toString();
  }

  @view({})
  verifyProvenance({ hash }: { hash: string }): boolean {
    return !!this.provenanceExists.get(hash);
  }

  @view({})
  getOwner(): string {
    return this.owner;
  }

  @view({})
  getAuthorizedServer(): string {
    return this.authorizedServer;
  }

  // ═══════════ Admin ═══════════

  @call({})
  setAuthorizedServer({ authorized_server }: { authorized_server: string }) {
    if (near.predecessorAccountId() !== this.owner) throw new Error("Only owner");
    this.authorizedServer = authorized_server;
  }
}
