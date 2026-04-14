/**
 * Shared chain adapter singletons (per-chain)
 *
 * 같은 프라이빗 키를 쓰는 여러 서비스가 각자 StatusAdapter를 생성하면
 * ethers.Wallet nonce 카운터가 분리돼 트랜잭션 충돌이 발생함.
 * 체인별 싱글톤을 유지해서 nonce를 단일 인스턴스가 관리하게 함.
 *
 * getSharedChainAdapter() — 기존 기본(env CHAIN_ADAPTER) 어댑터 반환
 * getChainAdapter(name)   — 특정 체인 어댑터 반환 (런타임 스위칭)
 */

import { createChainAdapter } from './index';
import { StatusAdapter } from './status-adapter';
import { NearAdapter } from './near-adapter';
import { MockAdapter } from './mock-adapter';
import type { IChainAdapter } from './interface';

export type ChainName = 'status' | 'near' | 'mock';

let _default: IChainAdapter | null = null;
const _perChain: Map<ChainName, IChainAdapter> = new Map();

export function getSharedChainAdapter(): IChainAdapter {
  if (!_default) _default = createChainAdapter();
  return _default;
}

export function getChainAdapter(chain?: ChainName): IChainAdapter {
  // chain 미지정 시 env 기본값
  if (!chain) return getSharedChainAdapter();

  const cached = _perChain.get(chain);
  if (cached) return cached;

  let adapter: IChainAdapter;
  switch (chain) {
    case 'status':
      adapter = new StatusAdapter();
      break;
    case 'near':
      adapter = new NearAdapter();
      break;
    case 'mock':
      adapter = new MockAdapter();
      break;
    default:
      adapter = new MockAdapter();
  }
  _perChain.set(chain, adapter);
  return adapter;
}
