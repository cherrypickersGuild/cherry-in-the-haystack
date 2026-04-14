/**
 * MockAdapter — DEMO_FALLBACK용 목 어댑터
 *
 * 실제 블록체인 호출 없이 랜덤 해시를 반환.
 * 개발/데모에서 블록체인 연결 없이 전체 플로우를 테스트할 때 사용.
 */

import { IChainAdapter, TxResult, KarmaTier } from "./interface";
import crypto from "crypto";

function randomHash(): string {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

export class MockAdapter implements IChainAdapter {
  async recordProvenance(hash: string, agent: string, conceptId: string): Promise<TxResult> {
    const txHash = randomHash();
    return {
      hash: txHash,
      chain: "mock",
      explorerUrl: `https://sepoliascan.status.network/tx/${txHash}`,
    };
  }

  async depositCredit(agent: string, amount: number): Promise<TxResult> {
    const txHash = randomHash();
    return {
      hash: txHash,
      chain: "mock",
      explorerUrl: `https://sepoliascan.status.network/tx/${txHash}`,
    };
  }

  async consumeCredit(agent: string, amount: number, conceptId: string, actionType: string): Promise<TxResult> {
    const txHash = randomHash();
    return {
      hash: txHash,
      chain: "mock",
      explorerUrl: `https://sepoliascan.status.network/tx/${txHash}`,
    };
  }

  async withdrawReward(curator: string, amount: number): Promise<TxResult> {
    const txHash = randomHash();
    return {
      hash: txHash,
      chain: "mock",
      explorerUrl: `https://sepoliascan.status.network/tx/${txHash}`,
    };
  }

  async getKarmaTier(address: string): Promise<KarmaTier> {
    // 목 데이터: Silver 티어
    return { tier: "Silver", balance: 1250 };
  }
}
