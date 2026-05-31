# Writer Agent

`writer_agent` builds a Concept Reader page from GraphDB ontology data and the local evidence Postgres DB.

## What It Does

- Resolves a focus concept from GraphDB.
- Pulls parent/child and related concepts from GraphDB.
- Pulls evidence chunks and key-idea style support from the local evidence DB.
- Generates a 4-section Concept Reader JSON with Claude:
  - `overview`
  - `cherries`
  - `child_concepts`
  - `progressive_references`
- Converts the output into frontend-friendly payloads and a local HTML preview.

## Required Environment

Create `python_services/packages/agent/writer_agent/.env` with:

```bash
GRAPHDB_ENDPOINT=http://localhost:7200/repositories/llm-ontology
GRAPHDB_NAMESPACE=http://example.org/llm-ontology#

LOCAL_DB_HOST=...
LOCAL_DB_PORT=5432
LOCAL_DB_USER=...
LOCAL_DB_PASSWORD=...
LOCAL_DB_NAME=...
LOCAL_DB_SSLMODE=require

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...
ANTHROPIC_MAX_OUTPUT_TOKENS=4096
ANTHROPIC_TEMPERATURE=0
```

`DATABASE_URL` is still supported as a fallback, but `LOCAL_DB_*` is the primary path.

## Dependencies

Install the Python dependencies used by the agent, plus the runtime packages required in the current setup:

```bash
pip3 install --user anthropic psycopg2-binary SPARQLWrapper
```

GraphDB is expected to come from `python_services/packages/idea_to_graph_ontology`.

## GraphDB Setup

```bash
cd python_services/packages/idea_to_graph_ontology
bash setup_graphdb.sh
```

Useful endpoints:

- GraphDB UI: `http://localhost:7200`
- Repository endpoint: `http://localhost:7200/repositories/llm-ontology`

## Connection Checks

GraphDB:

```bash
python3 python_services/packages/agent/writer_agent/test_graphdb_connection.py
```

Evidence DB:

```bash
python3 python_services/packages/agent/writer_agent/test_evidence_db_connection.py
```

Optional inspection helpers:

```bash
python3 python_services/packages/agent/writer_agent/inspect_graphdb.py
python3 python_services/packages/agent/writer_agent/inspect_evidence_db.py
python3 python_services/packages/agent/writer_agent/print_graphdb_tree.py
```

## Run The Agent

Run a concept directly:

```bash
python3 python_services/packages/agent/writer_agent/run_writer_agent.py "RAG"
```

Save outputs to a custom directory:

```bash
env WRITER_OUTPUT_DIR=/private/tmp/writer_smoke_output \
python3 python_services/packages/agent/writer_agent/run_writer_agent.py "RAG"
```

The current smoke-test example was written to:

```text
/private/tmp/writer_smoke_output/RAG_20260531_165604.json
```

## Output Schema

The main output is JSON in this shape:

```json
{
  "topic": "RAG",
  "section": "Basics",
  "overview": {
    "title": "Retrieval-Augmented Generation",
    "summary": "...",
    "why_it_matters": "..."
  },
  "cherries": [
    {
      "source": "Designing Machine Learning Systems (Chip Huyen, 2022)",
      "insights": [
        {
          "claim": "...",
          "evidence_id": "chunk_42",
          "excerpt": "..."
        }
      ]
    }
  ],
  "child_concepts": [
    {
      "label": "Vector Databases",
      "relation_type": "child",
      "description": "..."
    }
  ],
  "progressive_references": [
    {
      "order": 1,
      "title": "Designing Machine Learning Systems, Ch. 6",
      "what_it_teaches": "...",
      "why_next": "...",
      "source": {
        "book_title": "Designing Machine Learning Systems",
        "book_author": "Chip Huyen"
      }
    }
  ]
}
```

## Frontend Transform

Convert a writer output JSON into a frontend payload:

```bash
python3 python_services/packages/agent/writer_agent/format_for_frontend.py \
  /private/tmp/writer_smoke_output/RAG_20260531_165604.json
```

Build a local preview HTML:

```bash
python3 python_services/packages/agent/writer_agent/build_front_preview.py \
  /private/tmp/writer_smoke_output/RAG_20260531_165604.json
```

The transformed payload includes:

- `cherry_cards`
- `child_concept_groups`
- `progressive_reading_list`
- `learning_roadmap`
- `meta`
- `content_md`

`new_in_digest` and `knowledge_team` are currently left empty.

## Current Data Flow

1. Resolve the focus concept from GraphDB.
2. Read hierarchy from GraphDB:
   - `rdfs:subClassOf` parent -> `parent`
   - `rdfs:subClassOf` child -> `child`
   - `llm:related` currently collapses into `child`
3. Pull GraphDB concept instances if they exist.
4. Pull evidence from the local DB, prioritizing key-idea style retrieval and chunk joins.
5. Ask Claude to synthesize the 4-section page.
6. Build frontend payloads and preview output.

## Main Files

- `run_writer_agent.py`: main pipeline
- `db_utils.py`: env loading and DB URL resolution
- `format_for_frontend.py`: frontend payload transform
- `build_front_preview.py`: static preview generator
- `test_graphdb_connection.py`: GraphDB smoke check
- `test_evidence_db_connection.py`: Postgres smoke check
