import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// .env는 apps/api/.env에 있음 (모노레포 구조)
dotenv.config({ path: path.resolve(__dirname, "../api/.env") });

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    // Status Network Sepolia (gasless L2)
    statusSepolia: {
      url: process.env.STATUS_RPC_URL || "https://public.sepolia.rpc.status.network",
      chainId: 1660990954,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 0,
    },
    // opBNB Testnet (Day 4용)
    opbnbTestnet: {
      url: "https://opbnb-testnet-rpc.bnbchain.org:8545",
      chainId: 5611,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;
