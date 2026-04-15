/**
 * Status Network Hoodi RLN whitelist 상태 체크.
 *
 * RLN(Rate Limiting Nullifier)는 Status L2의 기본 rate limiting 메커니즘.
 * 화이트리스트된 주소: priorityFee = 0 (gasless)
 * 화이트리스트 안 된 주소: priorityFee = 100 gwei 같은 페널티 부과
 *
 * 사용:
 *   cd apps/contracts
 *   pnpm ts-node scripts/check-hoodi-rln.ts
 * 또는:
 *   npx hardhat run scripts/check-hoodi-rln.ts --network statusHoodi
 */

import { ethers, FetchRequest } from "ethers";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../api/.env") });

FetchRequest.registerGetUrl(FetchRequest.createGetUrlFunc({ family: 4 }));

// 확인할 주소 — .env 코멘트의 Hoodi Deployer
const TARGET_ADDRESS = "0xdab76820d6BEb239DB5ec031a6970f59EEbae130";
const GWEI = 1_000_000_000n;

async function main() {
  const rpcUrl = process.env.STATUS_HOODI_RPC_URL || "https://public.hoodi.rpc.status.network";

  const provider = new ethers.JsonRpcProvider(
    rpcUrl,
    { chainId: 374, name: "statusHoodi" },
    { batchMaxCount: 1 }
  );

  console.log("═══════════════════════════════════════");
  console.log("Status Network Hoodi — RLN whitelist check");
  console.log("Target:", TARGET_ADDRESS);
  console.log("RPC:   ", rpcUrl);
  console.log("═══════════════════════════════════════\n");

  // 1. 기본 연결 체크
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log("✓ RPC alive — block:", blockNumber);
  } catch (e: any) {
    console.log("✗ RPC unreachable:", e.message);
    return;
  }

  // 2. 잔고 확인
  const balance = await provider.getBalance(TARGET_ADDRESS);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // 3. 단순 ETH transfer 가정한 linea_estimateGas 호출
  //    화이트리스트 상태가 이 응답의 priorityFee에 반영됨
  console.log("\nlinea_estimateGas (simple transfer)...");
  try {
    const gas: any = await provider.send("linea_estimateGas", [{
      from: TARGET_ADDRESS,
      to: TARGET_ADDRESS, // self-transfer
      value: "0x0",
    }]);

    const gasLimit = BigInt(gas.gasLimit);
    const baseFee = BigInt(gas.baseFeePerGas ?? 0);
    const priorityFee = BigInt(gas.priorityFeePerGas ?? 0);

    console.log("  gasLimit:    ", gasLimit.toString());
    console.log("  baseFee:     ", baseFee.toString(), `(${baseFee / GWEI} gwei)`);
    console.log("  priorityFee: ", priorityFee.toString(), `(${priorityFee / GWEI} gwei)`);

    console.log("\n═══════════════════════════════════════");
    if (priorityFee === 0n) {
      console.log("✓ WHITELISTED (RLN-free)");
      console.log("  → 가스리스로 트랜잭션 가능. 배포 진행 OK.");
    } else if (priorityFee >= 10n * GWEI) {
      console.log("✗ NOT whitelisted (RLN deny-list)");
      console.log(`  → priorityFee ${priorityFee / GWEI} gwei penalty 부과 중.`);
      console.log("  → @yjkellyjoo (Status L2 팀) 화이트리스트 대기 필요.");
    } else {
      console.log("? 상태 불명확. priorityFee:", priorityFee.toString());
      console.log("  → 10 gwei 이상이면 deny-list, 0이면 whitelist, 중간값은 일반 네트워크 부하 가능.");
    }
    console.log("═══════════════════════════════════════");
  } catch (e: any) {
    console.log("✗ linea_estimateGas failed:", e.message ?? e);
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exitCode = 1;
});
