/**
 * Chain Adapter 팩토리
 *
 * 환경변수에 따라 올바른 체인 어댑터를 반환.
 * DEMO_FALLBACK=true → MockAdapter (블록체인 연결 없이 동작)
 * CHAIN_ADAPTER=status → StatusAdapter (Status Network 연결)
 * CHAIN_ADAPTER=bnb → BnbAdapter (Day 4에 구현)
 * CHAIN_ADAPTER=near → NearAdapter (Day 4에 구현)
 */

import { IChainAdapter } from "./interface";
import { MockAdapter } from "./mock-adapter";
import { StatusAdapter } from "./status-adapter";

export function createChainAdapter(): IChainAdapter {
  // DEMO_FALLBACK이면 무조건 Mock
  if (process.env.DEMO_FALLBACK === "true") {
    return new MockAdapter();
  }

  const adapter = process.env.CHAIN_ADAPTER ?? "mock";

  switch (adapter) {
    case "status":
      return new StatusAdapter();
    // Day 4에 추가:
    // case "bnb":
    //   return new BnbAdapter();
    // case "near":
    //   return new NearAdapter();
    default:
      return new MockAdapter();
  }
}

export type { IChainAdapter, TxResult, KarmaTier } from "./interface";
export { MockAdapter } from "./mock-adapter";
export { StatusAdapter } from "./status-adapter";
