/**
 * Status Sepolia CherryCredit 의 authorizedServer 를 새 지갑으로 추가.
 *
 * 목적:
 *   - 기존 배포자 키 (0xd4452aa4…e7C4, .env의 DEPLOYER_PRIVATE_KEY) 는 owner 로 그대로 유지
 *   - 새 운영 지갑 (0xdab76820…e130, Hoodi용 키와 동일) 를 authorizedServer 로 설정
 *   - 이후 새 키만 있어도 deposit / consumeCredit / distributeReward / recordProvenance 호출 가능
 *   - 비상시 옛 키는 여전히 owner 권한 유지 → setAuthorizedServer 재호출로 교체 가능
 *
 * 결과:
 *   - 컨트랙트 재배포 없음
 *   - .env 변경 없음
 *   - 단 한 번의 트랜잭션으로 권한 추가
 *
 * 실행:
 *   cd apps/contracts
 *   pnpm ts-node scripts/set-authorized-server.ts
 */

import { ethers, FetchRequest } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../api/.env") });

// 새 operator 지갑 주소 — .env 코멘트에 있는 "HOODI Deployer" 와 동일
// (주소는 공개 정보이므로 스크립트에 하드코딩)
const NEW_AUTHORIZED_SERVER = "0xdab76820d6BEb239DB5ec031a6970f59EEbae130";

FetchRequest.registerGetUrl(FetchRequest.createGetUrlFunc({ family: 4 }));

async function main() {
  const rpcUrl = process.env.STATUS_RPC_URL;
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  const contractAddress = process.env.CHERRY_CREDIT_ADDRESS;

  if (!rpcUrl) throw new Error("STATUS_RPC_URL missing in .env");
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY missing in .env");
  if (!contractAddress) throw new Error("CHERRY_CREDIT_ADDRESS missing in .env");

  // Sepolia chainId = 1660990954
  const provider = new ethers.JsonRpcProvider(
    rpcUrl,
    { chainId: 1660990954, name: "statusSepolia" },
    { batchMaxCount: 1 }
  );

  const owner = new ethers.Wallet(pk, provider);
  console.log("═══════════════════════════════════════");
  console.log("Owner (signer):       ", owner.address);
  console.log("New authorizedServer: ", NEW_AUTHORIZED_SERVER);
  console.log("Contract:             ", contractAddress);
  console.log("RPC:                  ", rpcUrl);
  console.log("═══════════════════════════════════════\n");

  // 현재 상태 먼저 확인
  const abi = [
    "function owner() view returns (address)",
    "function authorizedServer() view returns (address)",
    "function setAuthorizedServer(address _server)",
  ];
  const contract = new ethers.Contract(contractAddress, abi, owner);

  const currentOwner: string = await contract.owner();
  const currentAuth: string = await contract.authorizedServer();
  console.log("Current owner:           ", currentOwner);
  console.log("Current authorizedServer:", currentAuth);

  if (currentOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error(
      `Signer (${owner.address}) is NOT the current owner (${currentOwner}). ` +
      `Cannot call setAuthorizedServer.`
    );
  }

  if (currentAuth.toLowerCase() === NEW_AUTHORIZED_SERVER.toLowerCase()) {
    console.log("\n✓ authorizedServer is already set to the new address. Nothing to do.");
    return;
  }

  // linea_estimateGas 로 Status Network 맞춤 가스 계산
  const data = contract.interface.encodeFunctionData("setAuthorizedServer", [
    NEW_AUTHORIZED_SERVER,
  ]);
  const nonce = await provider.getTransactionCount(owner.address);
  console.log("\nNonce:", nonce);

  let gasLimit: bigint;
  let gasPrice: bigint;
  try {
    const lineaGas: any = await provider.send("linea_estimateGas", [{
      from: owner.address,
      to: contractAddress,
      data,
    }]);
    gasLimit = BigInt(lineaGas.gasLimit);
    const baseFee = BigInt(lineaGas.baseFeePerGas ?? 0);
    const priorityFee = BigInt(lineaGas.priorityFeePerGas ?? 0);
    gasPrice = baseFee + priorityFee;
    console.log(`linea gas: limit=${gasLimit}, base=${baseFee}, priority=${priorityFee}`);
  } catch (err: any) {
    // Sepolia는 linea_estimateGas 미지원일 수도 → 기본 eth_estimateGas로 fallback
    console.log("linea_estimateGas failed, falling back to eth_estimateGas:", err.message);
    gasLimit = await provider.estimateGas({ from: owner.address, to: contractAddress, data });
    const feeData = await provider.getFeeData();
    gasPrice = feeData.gasPrice ?? BigInt(0);
  }

  const tx = {
    type: 0,
    chainId: 1660990954,
    nonce,
    to: contractAddress,
    data,
    gasLimit,
    gasPrice,
    value: 0,
  };

  console.log("\nSigning...");
  const signed = await owner.signTransaction(tx);
  console.log("Broadcasting...");
  const txResp = await provider.broadcastTransaction(signed);
  console.log("tx hash:", txResp.hash);
  console.log("Waiting for confirmation...");
  const receipt = await txResp.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed. Status: ${receipt?.status}`);
  }

  const newAuth: string = await contract.authorizedServer();
  console.log("\n═══════════════════════════════════════");
  console.log("✓ setAuthorizedServer complete");
  console.log("New authorizedServer:", newAuth);
  console.log("Owner (unchanged):   ", currentOwner);
  console.log("tx:                  ", txResp.hash);
  console.log("Explorer:            ", `https://sepoliascan.status.network/tx/${txResp.hash}`);
  console.log("═══════════════════════════════════════");
  console.log("\nNo .env changes needed.");
  console.log("Old key (DEPLOYER_PRIVATE_KEY) remains owner → emergency fallback.");
  console.log("New key (0xdab76820…) can now call deposit/consumeCredit/distributeReward/recordProvenance.");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exitCode = 1;
});
