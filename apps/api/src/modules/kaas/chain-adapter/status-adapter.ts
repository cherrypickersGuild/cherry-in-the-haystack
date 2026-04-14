/**
 * StatusAdapter — Status Network (Sepolia) 온체인 어댑터
 *
 * ethers.js v6로 Status Network에 연결하여 CherryCredit.sol 함수를 호출.
 * gasPrice: 0 (gasless 체인)
 *
 * Note: Tailscale VPN 환경에서 Node.js global fetch가 IPv6를 먼저 시도해서
 * Status Network RPC 연결에 실패하는 문제가 있음.
 * 해결책: ethers.js FetchRequest를 Node.js https 모듈 (family: 4)로 오버라이드.
 */

import * as https from "https";
import { ethers, FetchRequest } from "ethers";
import { IChainAdapter, TxResult, KarmaTier } from "./interface";

// ethers.js FetchRequest가 Node.js https (IPv4 강제)를 쓰도록 오버라이드
FetchRequest.registerGetUrl(async (req: FetchRequest): Promise<import("ethers").FetchResponse> => {
  const url = new URL(req.url);
  const body = req.body ? Buffer.from(req.body) : null;

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port ? Number(url.port) : 443,
      path: url.pathname + url.search,
      method: req.method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": body.length } : {}),
      },
      family: 4, // IPv4 강제 — Tailscale VPN에서 IPv6 연결 실패 방지
    };

    const r = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const bodyBuf = Buffer.concat(chunks);
        resolve(new ethers.FetchResponse(
          res.statusCode ?? 200,
          res.statusMessage ?? "OK",
          Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, String(v)])),
          bodyBuf,
          req,
        ));
      });
    });

    r.on("error", reject);
    r.setTimeout(15000, () => { r.destroy(new Error("Request timeout")); });

    if (body) r.write(body);
    r.end();
  });
});

// CherryCredit.sol ABI (필요한 함수만)
const CHERRY_CREDIT_ABI = [
  "function deposit(address agent, uint256 amount) external",
  "function consumeCredit(address agent, uint256 amount, string conceptId, string actionType) external",
  "function distributeReward(address curator, uint256 amount, string conceptId) external",
  "function recordProvenance(bytes32 hash, address agent, string conceptId) external",
  "function getCredits(address agent) external view returns (uint256)",
  "function getRewards(address curator) external view returns (uint256)",
  "function verifyProvenance(bytes32 hash) external view returns (bool)",
  "event CreditConsumed(address indexed agent, uint256 amount, string conceptId, string actionType, uint256 remainingBalance)",
  "event RewardDistributed(address indexed curator, uint256 amount, string conceptId)",
  "event ProvenanceRecorded(bytes32 indexed hash, address indexed agent, string conceptId, uint256 timestamp)",
];

const EXPLORER_BASE = "https://sepoliascan.status.network/tx/";

export class StatusAdapter implements IChainAdapter {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    const rpcUrl = process.env.STATUS_RPC_URL || "https://public.sepolia.rpc.status.network";
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const contractAddress = process.env.CHERRY_CREDIT_ADDRESS;

    if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");
    if (!contractAddress) throw new Error("CHERRY_CREDIT_ADDRESS not set");

    const network = new ethers.Network("status-sepolia", 1660990954);
    this.provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, CHERRY_CREDIT_ABI, this.signer);
  }

  async recordProvenance(hash: string, agent: string, conceptId: string): Promise<TxResult> {
    const bytes32Hash = ethers.keccak256(ethers.toUtf8Bytes(hash));
    const tx = await this.contract.recordProvenance(bytes32Hash, agent, conceptId, { gasPrice: 0 });
    const receipt = await tx.wait();
    return {
      hash: receipt.hash,
      chain: "Status Network",
      explorerUrl: EXPLORER_BASE + receipt.hash,
    };
  }

  async depositCredit(agent: string, amount: number): Promise<TxResult> {
    const tx = await this.contract.deposit(agent, amount, { gasPrice: 0 });
    const receipt = await tx.wait();
    return {
      hash: receipt.hash,
      chain: "Status Network",
      explorerUrl: EXPLORER_BASE + receipt.hash,
    };
  }

  async consumeCredit(agent: string, amount: number, conceptId: string, actionType: string): Promise<TxResult> {
    const tx = await this.contract.consumeCredit(agent, amount, conceptId, actionType, { gasPrice: 0 });
    const receipt = await tx.wait();
    return {
      hash: receipt.hash,
      chain: "Status Network",
      explorerUrl: EXPLORER_BASE + receipt.hash,
    };
  }

  async withdrawReward(curator: string, amount: number): Promise<TxResult> {
    const tx = await this.contract.distributeReward(curator, amount, "withdrawal", { gasPrice: 0 });
    const receipt = await tx.wait();
    return {
      hash: receipt.hash,
      chain: "Status Network",
      explorerUrl: EXPLORER_BASE + receipt.hash,
    };
  }

  async getKarmaTier(address: string): Promise<KarmaTier> {
    const balance = 1250; // mock — Karma 컨트랙트 연동 예정
    let tier: KarmaTier["tier"] = "Bronze";
    if (balance >= 10000) tier = "Platinum";
    else if (balance >= 1000) tier = "Gold";
    else if (balance >= 100) tier = "Silver";
    return { tier, balance };
  }
}
