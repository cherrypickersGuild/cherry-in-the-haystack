# Cherry in the Haystack

> Knowledge → Skills → Agents

---

## 🚀 Press Release

**Cherry in the Haystack Introduces a Skill Layer for AI Agents**
*Built on top of Flock.ai and integrated with Agent Protocols (ACP / Virtuals on Base)*

**Seoul, South Korea — April 25, 2026**

Cherry in the Haystack announces a new direction:
**a knowledge-to-skill layer for AI agents**, designed to work alongside decentralized AI systems like Flock.ai and agent protocols such as ACP / Virtuals on Base.

> Models exist — but they are not easily usable.

Cherry converts knowledge into **installable skills for agents**.

---

## ⚡ What You Can Do (TL;DR)

* Turn knowledge into agent skills
* Install skills into your agent
* Run workflows immediately
* (Optional) connect to onchain agent ecosystems

---

# 🛠️ Technical Manual

## 1. Quick Start (5 min)

### Step 1 — Install dependencies

```bash
# Node
pnpm install

# Python (for AI pipeline)
poetry install
```

---

### Step 2 — Run local services

```bash
docker-compose up -d
```

This starts:

* PostgreSQL (data)
* GraphDB (knowledge graph)
* Redis (queue/cache)

---

### Step 3 — Configure environment

```bash
cp .env.example .env
```

Fill in:

```bash
# Core
OPENAI_API_KEY=...

# Optional (onchain / advanced)
NEAR_AI_KEY=...
STATUS_RPC_URL=...
DEPLOYER_PRIVATE_KEY=...
```

---

### Step 4 — Start the system

```bash
pnpm dev
```

Then open:

```
http://localhost:3000
```

---

## 2. First Run (UI Walkthrough)

### 1️⃣ Register an Agent

* Open dashboard
* Click "Register Agent"
* Connect wallet (optional)
* Get API key

---

### 2️⃣ Browse Skills

* Go to Catalog
* View available concepts / skills
* Each skill includes:

  * description
  * quality score
  * evidence

---

### 3️⃣ Install a Skill

* Click Purchase / Install
* Confirm transaction (or demo mode)

Result:

Agent now has access to structured workflow knowledge.

---

### 4️⃣ Run a Skill

* Open Chat / Agent Console
* Ask:

```
Use MCP skill to build a simple agent
```

or

```
Apply RAG workflow to this dataset
```

---

### 5️⃣ (Optional) Enable Privacy Mode

* Toggle 🔒 Privacy Mode

This routes execution through TEE:

* input hidden
* reasoning hidden
* only output returned

---

## 3. CLI / Agent Integration

### Option A — MCP (Recommended)

```bash
claude mcp add cherry-kaas apps/api/start-mcp.sh \
  --env KAAS_AGENT_API_KEY=YOUR_KEY
```

Now your agent can:

* browse skills
* install knowledge
* execute workflows

---

### Option B — REST API

```bash
POST /api/skills/install
POST /api/skills/run
GET  /api/catalog
```

---

### Option C — WebSocket (Realtime)

* subscribe to skill updates
* track agent activity

---

## 4. Core Workflow (How It Works)

```
Knowledge → Structured Graph → Skill → Agent Execution
```

1. Data ingestion (RSS, docs, etc.)
2. AI scoring + classification
3. Human validation
4. Convert to structured format
5. Package as skill
6. Agent installs and runs

---

## 5. Minimal Skill Example

```json
{
  "name": "RAG Basic",
  "steps": [
    "embed documents",
    "store in vector DB",
    "retrieve relevant chunks",
    "generate answer"
  ]
}
```

Agent usage:

```
Run RAG Basic on this dataset
```

---

## 6. Directory Structure (Simplified)

```
apps/
  api/        → backend (skills, marketplace)
  web/        → dashboard
  contracts/  → onchain logic

pipeline/
  ingestion/
  scoring/
  synthesis/
```

---

## 7. Advanced (Optional)

### 🔗 Onchain Integration

* Works with Status / NEAR
* Records provenance
* Enables monetization

---

### 🔒 TEE (Privacy Execution)

* Powered via NEAR AI Cloud
* Ensures:

  * private queries
  * secure inference

---

### 🧠 Skill Marketplace

* creators publish skills
* agents install skills
* usage generates rewards

---

## 8. Troubleshooting

### Port already in use

```bash
lsof -i :3000
kill -9 <PID>
```

---

### Docker issues

```bash
docker-compose down
docker-compose up -d --build
```

---

### Env not loaded

```bash
export $(cat .env | xargs)
```

---

## 9. What This Actually Is

This repo is:

a system that turns knowledge into executable skills for agents

---

## 10. Direction

Cherry in the Haystack is evolving into:

the missing layer between models and execution

---

## 📄 About

Cherry in the Haystack transforms knowledge into structured, reusable skills for AI agents.

Built to integrate with:

* Flock.ai
* ACP / Virtuals on Base
* decentralized agent ecosystems
