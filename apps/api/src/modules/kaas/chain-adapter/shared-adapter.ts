/**
 * Shared chain adapter singleton
 *
 * 같은 프라이빗 키를 쓰는 여러 서비스가 각자 StatusAdapter를 생성하면
 * ethers.Wallet nonce 카운터가 분리돼 트랜잭션 충돌이 발생함.
 * 모듈 수준 싱글톤으로 공유해서 nonce를 단일 인스턴스가 관리하게 함.
 */

import { createChainAdapter } from './index';
import type { IChainAdapter } from './interface';

let _adapter: IChainAdapter | null = null;

export function getSharedChainAdapter(): IChainAdapter {
  if (!_adapter) {
    _adapter = createChainAdapter();
  }
  return _adapter;
}
