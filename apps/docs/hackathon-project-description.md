# Cherry KaaS — Knowledge-as-a-Service for AI Agents

## One-liner

A blockchain-powered marketplace where AI agents discover, purchase, and learn human-curated domain knowledge — with on-chain provenance and credit-based pricing.

## Problem

AI agents lack access to verified, structured domain knowledge. They rely on generic training data or unverified web scraping. There's no marketplace for curated, quality-scored knowledge that agents can programmatically acquire and learn from.

## Solution

Cherry KaaS enables AI agents (Claude, GPT, or custom) to:

1. **Browse** a curated knowledge catalog of AI/ML concepts with quality scores and curator evidence
2. **Purchase** knowledge (content_md) using credits, with blockchain-recorded provenance
3. **Learn** by integrating purchased knowledge into their context via MCP protocol
4. **Compare** their existing knowledge against the catalog to identify gaps

## How It Works

```
User registers Agent (MetaMask + LLM API Key)
  → Agent deposits credits (gasless on Status Network)
  → Agent browses Knowledge Catalog (9 curated AI/ML concepts)
  → Agent purchases concept (20cr) or follows (25cr with updates)
  → Cherry returns content_md + provenance hash
  → Agent learns the knowledge and can answer based on it
  → Curator earns 40% revenue share
```

## Key Features

- **Knowledge Catalog** — 9 curated AI/ML concepts with quality scores (0-5), curator evidence, and detailed markdown content
- **Agent Registration** — MetaMask wallet + LLM provider (Claude/GPT/Custom) + API key
- **Credit System** — Deposit, consume (with Karma tier discounts: Bronze 0%, Silver 5%, Gold 15%, Platinum 30%), ledger-based balance
- **Provenance** — SHA256 hash of every transaction, recorded with chain reference and explorer URL
- **MCP Server** — 5 tools for AI agents to programmatically interact with the catalog (search, get, purchase, follow, compare)
- **Knowledge Curation Admin** — CRUD for concepts + evidence, markdown editor with .md file upload
- **Gap Analysis** — Agents submit known topics with dates, Cherry identifies outdated knowledge and gaps with purchase recommendations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, TypeScript, PostgreSQL, Knex |
| Frontend | Next.js, React, TailwindCSS |
| Blockchain | Status Network Sepolia (gasless), Solidity, Hardhat, ethers.js v6 |
| AI Integration | MCP Protocol (Model Context Protocol), Anthropic SDK, OpenAI SDK |
| Smart Contract | CherryCredit.sol — deposit, consumeCredit, distributeReward, recordProvenance |

## Smart Contract

- **Address:** `0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b`
- **Chain:** Status Network Sepolia (Chain ID: 1660990954)
- **Gasless:** All transactions execute with gasPrice: 0

## MCP Tools

| Tool | Description |
|------|------------|
| `search_catalog` | Browse curated AI/ML concepts with quality scores |
| `get_concept` | Get concept details with curator evidence |
| `purchase_concept` | Purchase knowledge (20cr) — returns content_md + provenance |
| `follow_concept` | Follow concept (25cr) — includes future updates |
| `compare_knowledge` | Gap analysis — compare agent's knowledge vs catalog |

## API Endpoints

| Category | Endpoints |
|----------|----------|
| Agent | POST /register, GET /list, DELETE /:id |
| Catalog | GET /catalog, GET /catalog/:id, POST /catalog/compare |
| Credits | GET /balance, POST /deposit, GET /history |
| Purchase | POST /purchase, POST /follow |
| Admin | CRUD concepts (5), CRUD evidence (3) |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   Next.js Web   │     │  Claude Desktop  │
│   (Dashboard)   │     │   (MCP Client)   │
└────────┬────────┘     └────────┬─────────┘
         │ REST API              │ MCP (stdio)
         ▼                       ▼
┌─────────────────────────────────────────┐
│           NestJS API Server             │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Knowledge│ │  Credit  │ │Provenance│ │
│  │ Service  │ │  Service │ │ Service  │ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │             │            │       │
│  ┌────▼─────────────▼────────────▼────┐ │
│  │         PostgreSQL (RDS)           │ │
│  │  kaas.concept | kaas.agent | ...   │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌────────────────────────────────────┐ │
│  │     Chain Adapter (IChainAdapter)  │ │
│  │  Status Network | BNB | NEAR      │ │
│  └──────────────┬─────────────────────┘ │
└─────────────────┼───────────────────────┘
                  ▼
┌─────────────────────────────┐
│  CherryCredit.sol (Status)  │
│  0x153DAcC...682b           │
└─────────────────────────────┘
```

## Demo Flow

1. **Register Agent** — Connect MetaMask + select LLM type (Claude/GPT) + enter LLM API key
2. **Deposit Credits** — 500cr gasless on Status Network
3. **Browse Catalog** — 9 curated AI/ML concepts with quality scores
4. **Purchase RAG** — 20cr deducted, content_md + provenance hash returned
5. **Agent Learns** — Claude/GPT processes the purchased knowledge
6. **Verify On-chain** — Provenance hash visible on Status Network Explorer

## Team

Built for BuidlHack 2026 — extending the Cherry-in-the-Haystack platform.

## Links

- **Smart Contract:** [Status Explorer](https://sepoliascan.status.network/address/0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b)
- **GitHub:** [cherry-in-the-haystack](https://github.com/springCoolers/cherry-in-the-haystack)
