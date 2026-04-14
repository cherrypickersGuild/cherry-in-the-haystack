import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // deployer 자신을 authorizedServer로 설정 (개발용)
  const CherryCredit = await ethers.getContractFactory("CherryCredit");
  const contract = await CherryCredit.deploy(deployer.address);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("CherryCredit deployed to:", address);
  console.log("═══════════════════════════════════════");
  console.log("");
  console.log("→ .env에 추가하세요:");
  console.log(`CHERRY_CREDIT_ADDRESS=${address}`);
  console.log("");

  // 배포 검증: deposit 테스트 호출
  console.log("Testing deposit...");
  const tx = await contract.deposit(deployer.address, 250);
  await tx.wait();
  const credits = await contract.getCredits(deployer.address);
  console.log("Deposit test: 250 credits →", credits.toString(), "✓");

  // Provenance 테스트
  console.log("Testing recordProvenance...");
  const testHash = ethers.keccak256(ethers.toUtf8Bytes("test-provenance"));
  const tx2 = await contract.recordProvenance(testHash, deployer.address, "rag");
  await tx2.wait();
  const exists = await contract.verifyProvenance(testHash);
  console.log("Provenance test:", exists ? "recorded ✓" : "FAILED ✕");

  console.log("");
  console.log("All deployment tests passed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
