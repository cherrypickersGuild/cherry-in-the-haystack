# Setup & Execution Guide

How to configure, run, and verify the ontology pipeline.

---

## 0. Initial Setup (Fresh Clone)

### Prerequisites

- Python 3.12+, Poetry
- Docker (for GraphDB)
- DeepSeek API key

### Step 0.1: Environment Variables

Copy and configure `.env` at the project root:

```env
# Required — DeepSeek API
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk-your-deepseek-key
DEEPSEEK_API_KEY=sk-your-deepseek-key

# Required — OpenAI API (for structured output; valid key needed)
OPENAI_API_KEY=sk-your-openai-key

# Optional — Supabase (comment out for local SQLite)
# DATABASE_URL=postgresql://...

# API Server (required for pnpm dev:all)
CORS_ORIGINS=http://localhost:3000
PORT=4000
ENVIRONMENT=local
JWT_SECRET=any-value
AGENT_API_KEY=any-value
LOCAL_DB_HOST=127.0.0.1
LOCAL_DB_PORT=5432
LOCAL_DB_USER=postgres
LOCAL_DB_PASSWORD=postgres
LOCAL_DB_NAME=postgres
```

### Step 0.2: Install Dependencies

```bash
cd /Users/js/pipe/cherry-in-the-haystack
poetry install
```

Additional dependencies for `text_extract_ideas` (not in Poetry lockfile):

```bash
pip3 install sqlalchemy PyMuPDF langgraph tqdm aiohttp --target .venv/lib/python3.12/site-packages/
```

### Step 0.3: Start GraphDB

```bash
docker compose up -d graphdb
```

Verify: `curl -s http://localhost:7200/rest/repositories` should return `[]`.

### Step 0.4: Verify

```bash
curl -s http://localhost:7200/repositories/llm-ontology/size
# Should return 0 (empty repository — pipeline auto-loads ontology)
```

---

## 1. Adding Books and Updating GraphDB

### Full Workflow (Chapter 1 of a PDF)

```bash
# Clean slate (optional — only needed for fresh test)
curl -s -X POST http://localhost:7200/repositories/llm-ontology/statements \
  -H "Content-Type: application/sparql-update" \
  --data "DELETE WHERE { ?s ?p ?o . }"
rm -f local_dev.db

# Step A: PDF → SQLite (Chapter 1 only)
.venv/bin/python python_services/packages/text_extract_ideas/run_chapters.py \
  ".assets_pdf/AI Engineering.pdf" "1"

# Step B: SQLite → JSONL
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/export_concepts.py \
  local_dev.db concepts_export.jsonl

# Step C: JSONL → GraphDB
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py \
  --input concepts_export.jsonl \
  --task-name "my_book" \
  --source "Book Title" \
  --debug
```

> **What each step does:**
> - **Step A**: Reads PDF, splits into paragraphs, extracts concepts via DeepSeek, stores in `local_dev.db` (SQLite)
> - **Step B**: Exports concepts from SQLite to JSONL format
> - **Step C**: Extracts sub-topics → clusters → deduplicates → stores in GraphDB with parent-child hierarchy → generates TOC

### Important Notes

- The **first run** auto-loads the base ontology (222 LLM concepts) into GraphDB. You'll see `[Init] Base ontology missing, loading...` in the log.
- `DATABASE_URL` must be **commented out** in `.env` for local SQLite mode. Uncomment it when Supabase is ready.
- GraphDB container must be running (`docker compose up -d graphdb`).
- Chapter numbers use the **title**, not internal index. "Chapter 1. Introduction" matches `"1"`, not `"5"`.

---

## 2. Verifying Results

### 2.1 GraphDB Workbench (Visual)

Open **http://localhost:7200** in your browser.

**Class Hierarchy (tree view):**
- Left menu → `Explore` → `Class hierarchy`
- Expand `LLMConcept` → you should see a multi-level tree like:
  ```
  LLMConcept
  ├── ModelArchitecture
  │   ├── EncoderOnly
  │   │   ├── ALBERT
  │   │   └── BERT
  │   └── DecoderOnly
  │       └── GPTArchitecture
  ├── TrainingParadigm
  │   ├── Pretraining
  │   │   └── MaskedLanguageModeling
  │   └── Finetuning
  ...
  ```
- If all 200+ concepts are flat under `LLMConcept`, the parent determination failed (check logs).

**SPARQL Queries (`SPARQL` tab):**

Total classes:
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT (COUNT(*) AS ?total) WHERE { ?s a owl:Class . }
```
Expected: 222 (base) + new concepts from books.

Parent-child relationships (excluding self-references from RDFS inference):
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?concept ?label ?parent WHERE {
  ?concept a owl:Class ; rdfs:label ?label ; rdfs:subClassOf ?parent .
  FILTER(?concept != ?parent)
} ORDER BY ?parent
```

New concepts with proper parents (not LLMConcept):
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX llm: <http://example.org/llm-ontology#>
SELECT ?concept ?label ?parent WHERE {
  ?concept a owl:Class ; rdfs:label ?label ; rdfs:subClassOf ?parent .
  FILTER(?concept != ?parent && ?parent != llm:LLMConcept)
} ORDER BY ?parent LIMIT 30
```

### 2.2 Pipeline Logs

**Step 4 output (key metrics):**
```
Added:   XX     ← New concepts (lower is better — means more were filtered)
Duplicates (exact): XX  ← Exact matches skipped
Duplicates (near):  XX  ← Vector-similarity-based skips
```

**TOC summary:**
```
대 (depth 1):   11   ← Top-level categories (LLMConcept children)
중 (depth 2-3): 210  ← Sub-categories
소 (depth 4+):  14   ← Deep, specific concepts
```

**Layer 2 LLM log** (`db/pipeline_logs/layer2_log_*.json`):
Shows parent determination reasoning for each concept:
```json
{
  "concept_id": "MaskedLanguageModel",
  "status": "added",
  "parent": "MaskedLanguageModeling",
  "parent_candidates": [
    {"concept": "MaskedLanguageModeling", "score": 3},
    {"concept": "Pretraining", "score": 2}
  ],
  "parent_assignment_reason": "..."
}
```

### 2.3 TOC (CLI)

```bash
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py --toc-only
```

Outputs the full hierarchy with `[대]`/`[중]`/`[소]` tags by depth.

---

## Quick Reference: All Commands

```bash
# Start GraphDB
docker compose up -d graphdb

# Full pipeline (Chapter 1 of a PDF)
rm -f local_dev.db
.venv/bin/python python_services/packages/text_extract_ideas/run_chapters.py "PDF_PATH.pdf" "1"
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/export_concepts.py local_dev.db out.jsonl
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py --input out.jsonl --task-name test --source "Source" --debug

# View TOC
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py --toc-only

# Clear everything
curl -s -X POST http://localhost:7200/repositories/llm-ontology/statements \
  -H "Content-Type: application/sparql-update" \
  --data "DELETE WHERE { ?s ?p ?o . }"
rm -f local_dev.db

# GraphDB Workbench
open http://localhost:7200
```
