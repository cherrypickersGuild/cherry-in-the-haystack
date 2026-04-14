# Cherry in the Haystack

> AI Engineering knowledge handbook — curated, synthesized, always fresh.

A monorepo that continuously ingests AI Engineering content from the web, scores it for quality, synthesizes it into structured knowledge pages, and publishes it as a searchable handbook.

---

## 🏆 BuidlHack2026 Submission — Cherry KaaS

**Cherry Knowledge-as-a-Service (KaaS)** opens this curated handbook to AI agents via **MCP Protocol** + **on-chain payment/provenance**. Agents browse the catalog, purchase concepts with gasless crypto, and receive provable, auditable knowledge receipts on-chain.

### Multi-chain Deployment

| Track | Network | Contract / Account | Status |
|---|---|---|---|
| **Status Network** (Primary) | Status Sepolia — Chain ID `1660990954` | [`0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b`](https://sepoliascan.status.network/address/0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b) | ✅ Live, gasless |
| **NEAR AI Cloud** (TEE LLM) | `cloud-api.near.ai/v1` (Qwen3-30B) | API-level integration | ✅ Live |
| **NEAR Protocol** (L1 contract) | NEAR Testnet | [`tomatojams.testnet`](https://testnet.nearblocks.io/address/tomatojams.testnet) | ✅ Live |
| BNB Chain (opBNB) | Chain ID `5611` | — | ⏸ Skipped (track optional) |

**Key on-chain transactions (NEAR):**
- Contract deploy: [`HwTSRXMWJA5tWuLAw6n5YLKnhytm6McNJtxaTDwASJE9`](https://testnet.nearblocks.io/txns/HwTSRXMWJA5tWuLAw6n5YLKnhytm6McNJtxaTDwASJE9)
- Functions exercised on-chain: `init`, `deposit`, `recordProvenance`

### Features

- 🛒 **Agent Shopping** — 9 AI/ML concepts catalog, purchase with credits (20cr/purchase, 25cr/follow)
- 🔗 **Provenance on-chain** — Every purchase records a hash on Status Network; every re-purchase generates a unique hash (no duplicate rejection)
- 🔒 **Privacy Mode (NEAR AI TEE)** — Toggle in dashboard. When ON, sensitive agent data (knowledge list, purchase intent, content payload) is relayed through NEAR AI Cloud's TEE before server processing. Free chat is generated entirely in TEE.
- 🎁 **Curator Rewards** — 40% of each purchase auto-distributed to knowledge curator, recorded on-chain
- 🔌 **MCP Server** — stdio (Claude Desktop/Code) + Streamable HTTP. 5 tools + 2 resources. Elicitation & Sampling supported.
- 🌐 **WebSocket realtime** — knowledge updates, MCP session tracking

### Repo Guide for KaaS

| Path | Role |
|---|---|
| [`apps/contracts/contracts/CherryCredit.sol`](apps/contracts/contracts/CherryCredit.sol) | Solidity contract (Status, EVM) |
| [`apps/contracts-near/src/cherry_credit.ts`](apps/contracts-near/src/cherry_credit.ts) | NEAR near-sdk-js contract |
| [`apps/api/src/modules/kaas/`](apps/api/src/modules/kaas/) | NestJS API (catalog, purchase, credits, MCP, rewards) |
| [`apps/web/components/cherry/kaas-*.tsx`](apps/web/components/cherry/) | Web dashboard / console / catalog |
| [`apps/api/src/mcp-server.ts`](apps/api/src/mcp-server.ts) | MCP stdio server |
| [`apps/docs/KaaS/NEAR-integration.md`](apps/docs/KaaS/NEAR-integration.md) | NEAR integration full details |
| [`apps/docs/KaaS_plan/`](apps/docs/KaaS_plan/) | Implementation plan, checklist, progress log |
| [`apps/docs/KaaS/prd.md`](apps/docs/KaaS/prd.md), [`architecture.md`](apps/docs/KaaS/architecture.md), [`epics.md`](apps/docs/KaaS/epics.md) | Product / architecture / epic docs |

### KaaS Environment Variables (server-side)

```bash
# Status Network
DEPLOYER_PRIVATE_KEY=<server wallet for tx signing>
CHERRY_CREDIT_ADDRESS=0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b
STATUS_RPC_URL=https://public.sepolia.rpc.status.network
CHAIN_ADAPTER=status
DEMO_FALLBACK=false

# NEAR AI Cloud (LLM TEE)
NEAR_AI_KEY=sk-...   # cloud.near.ai/keys

# OpenAI (default non-privacy LLM)
OPENAI_API_KEY=sk-proj-...
```

Frontend env (public):
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Quick KaaS Demo Flow

1. `pnpm dev` → web at `:3000`, API at `:4000`
2. Open the KaaS Dashboard, register a new Agent (connect MetaMask for wallet address)
3. Catalog → select concept → **Purchase** — tx signed by server, recorded on Status
4. Toggle **🔒 Privacy Mode** ON → repeat purchase → content + intent relayed via NEAR AI TEE; chat LLM answered by Qwen3-30B
5. Dashboard → **Rewards** tab shows 40% curator revenue with tx links
6. `claude mcp add cherry-kaas apps/api/start-mcp.sh --env KAAS_AGENT_API_KEY=...` → Claude Desktop reads catalog & purchases natively

---

## Prerequisites

| Tool           | Version |
| -------------- | ------- |
| Node.js        | 20+     |
| pnpm           | 9+      |
| Python         | 3.10+   |
| Poetry         | 1.8+    |
| Docker Desktop | Latest  |

---

## Quick Start

```bash
# 1. Install TypeScript dependencies
pnpm install

# 2. Start local database services (PostgreSQL 16 + pgvector, GraphDB, Redis)
docker-compose up -d

# 3. Copy environment variables and fill in your values
cp .env.example .env

# 4. Install Python dependencies
poetry install

# 5. Start the development server
pnpm dev
```

---

## Project Structure

See [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md) for the full directory layout.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
