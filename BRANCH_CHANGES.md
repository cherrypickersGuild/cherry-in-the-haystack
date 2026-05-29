# Feature Branch Changes: `feature/ontology-refactor`

Base commit: `689b488` ([PR #24](https://github.com/cherrypickersGuild/cherry-in-the-haystack/issues/24) — Notion RSS pipeline merge)
Head commit: `7661b85` (auto-load base ontology, fix chapter filter)

---

## 1. Pre-branch State: What `python_services/` Did

### Overview

`python_services/` contained 4 packages responsible for AI knowledge ingestion and ontology management:

| Package | Role |
|---------|------|
| `text_extract_ideas` | PDF → paragraphs → concept extraction pipeline (LangGraph-based) |
| `idea_to_graph_ontology` | Concept → GraphDB ontology mapping (3-stage staging/commit workflow) |
| `news_collector` | Multi-source news ingestion (Notion RSS, web, YouTube) with multi-provider LLM |
| `agent/*` | Writer agent and news agent using OpenAI Agents SDK for content generation |

### Pre-branch Ontology Pipeline Flow

The `idea_to_graph_ontology` package had a **3-stage staging workflow**:

1. **Stage 1** (`assign_ontology_concept_to_chunk.py`): LangGraph 6-node workflow
   - Extract noun phrases from keywords → vector search (ChromaDB) → LLM match (OpenAI) → save new concepts (SQLite) → DBSCAN cluster → staging
2. **Stage 2** (`commit_ontology_assignment.py`): Manual TSV review → commit approved concepts to GraphDB
3. **Stage 3** (`add_relations.py`): Add ClassRelation, Instance, and Instance-to-Instance relations

Concepts were stored with explicit relations (`ClassRelation`, `instanceOf`, `relatedInstance`) rather than purely parent-child hierarchy.

### Pre-branch LLM Usage

| Package | LLM Provider | Model |
|---------|-------------|-------|
| `text_extract_ideas` | Google Vertex AI (`ChatVertexAI`) | `gemini-2.5-flash` |
| `idea_to_graph_ontology` | OpenAI (`ChatOpenAI`) | `gpt-4o-mini` (hardcoded in 5 files) |
| `news_collector` | Multi-provider (OpenAI/Google/Ollama) | Various |
| `agent/*` | OpenAI (`OpenAIProvider`) | `gpt-4.1` |

---

## 2. Changes Made on This Branch

### 2.1 New Files Created (Core Pipeline)

| File | Purpose |
|------|---------|
| `idea_to_graph_ontology/src/model.py` | Centralized LLM factory — `get_llm()` with provider-agnostic DeepSeek/OpenAI switching via env vars |
| `idea_to_graph_ontology/src/pipeline/topic_extractor.py` | Step 2: Extract 1-3 sub-topics from paragraph chunks via LLM |
| `idea_to_graph_ontology/src/pipeline/topic_clusterer.py` | Step 3: Cluster similar sub-topics via LLM (1st refinement) |
| `idea_to_graph_ontology/src/pipeline/graph_storer.py` | Step 4: Store in GraphDB with dedup (SPARQL + vector) and parent-child hierarchy |
| `idea_to_graph_ontology/src/pipeline/toc_generator.py` | Step 5: Generate hierarchical TOC classified by depth (대/중/소) |
| `idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py` | Unified CLI entry point for the new 5-step pipeline |
| `idea_to_graph_ontology/src/scripts/export_concepts.py` | Export SQLite `key_ideas` to JSONL for pipeline input |
| `python_services/packages/__init__.py` | Python package marker for import resolution |
| `idea_to_graph_ontology/__init__.py` | Package marker |
| `idea_to_graph_ontology/TEST_GUIDE.md` | Step-by-step test guide |

### 2.2 Files Modified (by commit)

**Commit `e058366` — Model Factory:**
- `concept_matcher.py` — `ChatOpenAI(os.getenv(...))` → `get_llm()`
- `document_ontology_mapper.py` — `ChatOpenAI(...)` → `get_llm()`
- `ontology_updater.py` — `ChatOpenAI(...)` → `get_llm()`, removed `llm: ChatOpenAI` type hint
- `rematch.py` — 2x `ChatOpenAI(...)` → `get_llm()`, removed unused `import os`
- `initialize_vector_db.py` — `ChatOpenAI(...)` → `get_llm()`, removed unused `import os`

**Commit `803c081` — Pipeline Rebuild:**
- New files only (see 2.1 above)

**Commit `46acbdf` — All-LLM DeepSeek Migration:**
- `text_extract_ideas/src/model/model.py` — `ChatVertexAI` → `ChatOpenAI` + DeepSeek config, added `parse_json_response()`
- `text_extract_ideas/src/utils/pdf/hierarchy_detector.py` — `with_structured_output()` → JSON-mode prompting + `parse_json_response()`
- `text_extract_ideas/src/workflow/nodes/process_section.py` — Same JSON-mode conversion
- `news_collector/src/llm_agent.py` — 3 providers (OpenAI/Google/Ollama) → DeepSeek only. `LLMAgentGemini` rewritten for DeepSeek. Removed `ChatGoogleGenerativeAI`, `ChatOllama`, `google.generativeai` imports.
- `news_collector/src/ArgumentAnalyzer.py` — `litellm.completion()` → `ChatOpenAI` + DeepSeek. Removed `litellm`, `openai` imports.
- `agent/writer_agent/run_writer_agent.py` — `OpenAIProvider(api_key=api_key)` → `OpenAIProvider(api_key=api_key, base_url="https://api.deepseek.com")`
- `agent/news_agent/code/run_news_agent.py` — Same OpenAIProvider → DeepSeek endpoint
- `pyproject.toml` — `packages = ["src/ontology"]` → `packages = ["src"]`

**Commit `cb6d984` — Parent Determination Fix:**
- `ontology_updater.py` — `_decide_parent_candidates()`: `with_structured_output()` → JSON-mode + vector fallback. Improved prompts to prefer deep hierarchy over LLMConcept.
- `graph_storer.py` — Added self-reference filter in `_determine_parent()`
- `text_extract_ideas/run_pipeline.py` — Added `init_db()` call, fixed model display
- `text_extract_ideas/run_chapters.py` — Added `init_db()` call, fixed model display
- `text_extract_ideas/src/workflow/nodes/process_section.py` — Fixed LangChain template `{}` escaping (`{{}}`)
- `text_extract_ideas/src/utils/pdf/hierarchy_detector.py` — Same `{}` escaping fix
- `export_concepts.py` — New file (SQLite → JSONL)

**Commit `e30cff2` / `7661b85` — Auto-load base ontology, chapter filter:**
- `run_ontology_pipeline.py` — Auto-detect missing base ontology (class count < 10) and load `llm_ontology.ttl`
- `run_chapters.py` — Chapter filter now uses title regex only (not internal index)
- `.gitignore` — Added `*.jsonl`, `local_dev.db`, `python_services/packages/ontology`

### 2.3 New Pipeline Flow (Replaces Old 3-Stage Workflow)

```
JSONL Input (concept, section_id, section_title, chunk_text)
    │
    ▼
┌──────────────────────────────┐
│ topic_extractor.py           │  Step 2: DeepSeek extracts 1-3 sub-topics per chunk
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ topic_clusterer.py           │  Step 3: DeepSeek groups similar topics (1st refinement)
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ graph_storer.py              │  Step 4: Dedup (SPARQL exact + ChromaDB vector) →
│                              │  determine parent (LLM + vector fallback) →
│                              │  store in GraphDB with single parent
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ toc_generator.py             │  Step 5: Traverse GraphDB → classify by depth
│                              │  depth 1 = 대, depth 2-3 = 중, depth 4+ = 소
└──────────────────────────────┘
```

### 2.4 Node Structure Change

**Old**: ClassRelation + instanceOf + relatedInstance (explicit relations between all nodes)

**New**: Pure parent-child hierarchy
- `type`: `"class"` (broad category) or `"instance"` (specific technique)
- `parent`: Single confirmed value (not candidate array)
- `keywords`: Alternative names array
- `source`: Book/PDF origin identifier
- Layer 2 log: LLM decision process saved as JSON sidecar (not in DB)

---

## 3. Code Reused from Pre-branch Codebase

### Reused as-is (no modification needed)

| File | Purpose |
|------|---------|
| `graph_query_engine.py` | SPARQL query/update engine for GraphDB |
| `vector_store.py` | ChromaDB vector search with BAAI/bge-m3 embeddings |
| `ontology_graph_manager.py` | NetworkX graph management (hierarchy loading, subtree visualization, path-to-root) |
| `utils.py` | TTL parsing (`load_ontology_graph`, `load_all_concepts`, `update_ttl_descriptions`) |
| `data/llm_ontology.ttl` | Base ontology — 222 LLM/AI concepts in Turtle format |
| `data/config.ttl` | GraphDB repository configuration |
| `setup_graphdb.sh` | Docker setup script for GraphDB |

### Partially Modified

| File | What changed | Why |
|------|-------------|-----|
| `ontology_updater.py` | `_decide_parent_candidates()` — `with_structured_output()` → JSON-mode, improved prompt, added vector fallback | DeepSeek doesn't support `with_structured_output()` |
| `concept_matcher.py` | `ChatOpenAI(model=os.getenv(...))` → `get_llm()` | Centralized model config |
| `document_ontology_mapper.py` | `ChatOpenAI(...)` → `get_llm()`, removed unused `import os` | Same |
| `rematch.py` | 2x `ChatOpenAI` → `get_llm()`, removed unused `import os` | Same |
| `initialize_vector_db.py` | `ChatOpenAI(...)` → `get_llm()`, removed unused `import os` | Same |
| `add_relations.py` | `sys.path` fix for import resolution | Package structure fix |
| `assign_ontology_concept_to_chunk.py` | Same `sys.path` fix | Same |
| `commit_ontology_assignment.py` | Same `sys.path` fix | Same |
| `rollback_ontology.py` | Same `sys.path` fix | Same |
| `test_query_engine.py` | Same `sys.path` fix | Same |
| `storage/__init__.py` | Same `sys.path` fix | Same |

### Discarded (kept for reference, not used in new pipeline)

| File | Reason |
|------|--------|
| `document_ontology_mapper.py` (LangGraph workflow) | Replaced by new 5-step pipeline |
| `staging_manager.py` | Staging workflow eliminated |
| `new_concept_manager.py` (SQLite+DBSCAN) | Replaced by DeepSeek clustering |
| `assign_ontology_concept_to_chunk.py` (Stage 1) | Single unified pipeline instead |
| `commit_ontology_assignment.py` (Stage 2) | Direct GraphDB storage, no staging |
| `add_relations.py` (Stage 3) | No explicit relations — parent-child instead |
| `rollback_ontology.py` | GraphDB backup/rollback not needed for direct writes |

---

## Verified Results

Tested with two real PDFs (Chapter 1 each):

| Metric | First PDF | Second PDF |
|--------|-----------|------------|
| Sub-topics extracted | 259 | 143 |
| After clustering | ~200 | 124 |
| Added to GraphDB | ~40 | 40 |
| Duplicates (exact) | ~6 | 6 |
| Duplicates (near) | ~78 | 78 |
| Total classes | 260 | 299 |
| Hierarchy depth | 대11/중210/소14 | Same |

Second PDF achieved **68% duplicate filtering** (84/124 topics filtered as near-duplicate or exact duplicate).
