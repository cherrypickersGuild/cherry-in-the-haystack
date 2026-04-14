/**
 * NearAdapter — NEAR Protocol 체인 어댑터
 *
 * NEAR Testnet의 CherryCredit 컨트랙트와 상호작용.
 * near-api-js 사용, Ed25519 키로 tx 서명.
 *
 * 필수 환경변수:
 * - NEAR_CONTRACT_ACCOUNT: 컨트랙트 배포 계정 (예: tomatojams.testnet)
 * - NEAR_SIGNER_ACCOUNT: tx 서명 계정 (일반적으로 contract와 동일)
 * - NEAR_PRIVATE_KEY: ed25519:... 형식의 private key
 * - NEAR_RPC_URL (선택): 기본값 https://rpc.testnet.fastnear.com
 * - NEAR_NETWORK (선택): testnet | mainnet (기본 testnet)
 */

// near-api-js v7+ 는 ESM 전용 (package.json: "type": "module"). CJS require 불가.
// dynamic import로 로드 — 최초 사용 시 1회 로드.
let _nearApi: any = null;
async function loadNearApi(): Promise<any> {
  if (_nearApi) return _nearApi;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  _nearApi = await (Function("return import('near-api-js')") as () => Promise<any>)();
  return _nearApi;
}
import type { IChainAdapter, TxResult, KarmaTier } from "./interface";

// Nearblocks — NEAR 공식 선호 Explorer (구 explorer.testnet.near.org는 deprecated)
const EXPLORER_BASE = "https://testnet.nearblocks.io";

export class NearAdapter implements IChainAdapter {
  private near: any = null;
  private signer: any = null;
  private readonly contractAccount: string;
  private readonly signerAccount: string;
  private readonly networkId: string;
  private readonly rpcUrl: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.contractAccount = process.env.NEAR_CONTRACT_ACCOUNT ?? "tomatojams.testnet";
    this.signerAccount = process.env.NEAR_SIGNER_ACCOUNT ?? this.contractAccount;
    this.networkId = process.env.NEAR_NETWORK ?? "testnet";
    this.rpcUrl = process.env.NEAR_RPC_URL ?? "https://rpc.testnet.fastnear.com";
  }

  private async ensureReady(): Promise<void> {
    if (this.signer) return;
    if (!this.initPromise) this.initPromise = this.init();
    await this.initPromise;
  }

  private async init(): Promise<void> {
    const pk = process.env.NEAR_PRIVATE_KEY;
    if (!pk) throw new Error("NEAR_PRIVATE_KEY not set");

    const nearApi = await loadNearApi();
    // near-api-js v7 API: KeyPair → KeyPairSigner → JsonRpcProvider → Account
    const keyPair = nearApi.KeyPair.fromString(pk);
    const signer = new nearApi.KeyPairSigner(keyPair);
    const provider = new nearApi.JsonRpcProvider({ url: this.rpcUrl });
    this.signer = new nearApi.Account(this.signerAccount, provider, signer);
  }

  private makeTxResult(hash: string): TxResult {
    return {
      hash,
      chain: "near",
      // Nearblocks URL 형식: /txns/{hash}
      explorerUrl: `${EXPLORER_BASE}/txns/${hash}`,
    };
  }

  private async callContract(methodName: string, args: Record<string, unknown>, gasTgas = 30): Promise<string> {
    await this.ensureReady();
    if (!this.signer) throw new Error("NEAR signer not initialized");
    // 30 Tgas = 30 * 10^12
    const gas = BigInt(gasTgas) * BigInt("1000000000000");
    // v7 API: callFunctionRaw 사용 → RpcTransactionResponse 반환 (transaction.hash 포함)
    const outcome: any = await this.signer.callFunctionRaw({
      contractId: this.contractAccount,
      methodName,
      args,
      gas,
      deposit: BigInt(0),
    });
    const txHash = outcome?.transaction?.hash ?? outcome?.transaction_outcome?.id ?? outcome?.final_execution_status ?? "";
    if (!txHash) throw new Error(`Could not extract tx hash: ${JSON.stringify(outcome).slice(0, 200)}`);
    return txHash;
  }

  async recordProvenance(hash: string, agent: string, conceptId: string): Promise<TxResult> {
    const txHash = await this.callContract("recordProvenance", {
      hash,
      agent,
      conceptId,
    });
    return this.makeTxResult(txHash);
  }

  async depositCredit(agent: string, amount: number): Promise<TxResult> {
    const txHash = await this.callContract("deposit", {
      agent,
      amount: amount.toString(),
    });
    return this.makeTxResult(txHash);
  }

  async consumeCredit(agent: string, amount: number, conceptId: string, actionType: string): Promise<TxResult> {
    const txHash = await this.callContract("consumeCredit", {
      agent,
      amount: amount.toString(),
      conceptId,
      actionType,
    });
    return this.makeTxResult(txHash);
  }

  async withdrawReward(curator: string, amount: number): Promise<TxResult> {
    // NEAR 컨트랙트 측 distributeReward 이름으로 매핑
    const txHash = await this.callContract("distributeReward", {
      curator,
      amount: amount.toString(),
      conceptId: "_withdraw_",
    });
    return this.makeTxResult(txHash);
  }

  /** NEAR 체인에는 Karma 티어 개념 없음 — 기본값 반환 */
  async getKarmaTier(_address: string): Promise<KarmaTier> {
    return { tier: "Bronze", balance: 0 };
  }
}
