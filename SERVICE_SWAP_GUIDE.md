# Service Swap Guide

How to replace local infrastructure with production services.

---

## 1. Local SQLite → Supabase (PostgreSQL)

### Current State

The `text_extract_ideas` pipeline (`run_chapters.py`, `run_pipeline.py`) uses `DATABASE_URL` to decide where to store book/chapter/chunk/idea data:

```
DATABASE_URL set     → PostgreSQL (currently Supabase pooler)
DATABASE_URL unset   → SQLite fallback (local_dev.db)
```

This logic is in `python_services/packages/text_extract_ideas/src/db/connection.py` (lines 12-20):

```python
def get_database_url() -> str:
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url
    # Default to SQLite for local development
    return f"sqlite:///{os.path.join(os.getcwd(), 'local_dev.db')}"
```

### What You Need from Supabase

1. A Supabase project (create at https://supabase.com/dashboard)
2. The **Session Pooler** connection string from `Settings → Database → Connection info`
3. Format:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```

### How to Switch

In `.env`, uncomment or add:

```env
DATABASE_URL=postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

That's it. The pipeline automatically:
- Connects to Supabase instead of SQLite
- Creates tables on first run (`init_db()` calls `Base.metadata.create_all()`)
- Uses PostgreSQL connection pooling (`pool_size=10, max_overflow=20, pool_pre_ping=True`)

### Tables Created

| Table | Purpose |
|-------|---------|
| `books` | PDF metadata (title, author, source path) |
| `chapters` | Chapter hierarchy |
| `sections` | Section hierarchy within chapters |
| `paragraph_chunks` | Split paragraph text with position metadata |
| `key_ideas` | Extracted concepts linked to chunks |
| `idea_groups` | Canonical idea groupings |
| `processing_progress` | Pipeline resumability tracker |

### Verification

After switching, check that tables exist:

```bash
curl -s "https://api.supabase.com" # Not needed — just verify pipeline runs without errors
.venv/bin/python python_services/packages/text_extract_ideas/run_chapters.py "PDF.pdf" "1"
# Should print "✅ 책 생성: 'Book Title' (ID: 1)" without connection errors
```

---

## 2. Local GraphDB → Remote GraphDB

### Current State

GraphDB runs locally via Docker Compose (`docker compose up -d graphdb`) on port 7200. The pipeline connects via the `--graph-endpoint` CLI argument or `GRAPHDB_ENDPOINT` env var.

### What You Need

1. A remote GraphDB instance (self-hosted or Ontotext Cloud)
2. The SPARQL endpoint URL (e.g., `https://graphdb.example.com:7200/repositories/llm-ontology`)
3. The repository must already exist with the `llm-ontology` ID
4. Base ontology should be pre-loaded, or let the pipeline auto-load it (requires write access)

### How to Switch

One-line change — use the `--graph-endpoint` flag:

```bash
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py \
  --input concepts.jsonl \
  --task-name "test" \
  --graph-endpoint "https://your-server.com:7200/repositories/llm-ontology"
```

Or set the `GRAPHDB_ENDPOINT` environment variable (if your deployment script reads it).

### Authentication

If the remote GraphDB requires authentication, add credentials to the endpoint URL or configure GraphDB's security settings. The `GraphQueryEngine` (`src/storage/graph_query_engine.py`) doesn't currently support auth headers — add basic auth to the `requests.post()` calls if needed (lines 56-68):

```python
response = requests.post(
    update_endpoint,
    data=sparql_update,
    headers={
        "Content-Type": "application/sparql-update",
        "Authorization": "Basic <base64-credentials>",
    },
    timeout=30,
)
```

### Verification

```bash
curl -s "https://your-server.com:7200/repositories/llm-ontology/size"
# Should return a number > 0
```

---

## 3. DeepSeek → Another LLM Provider

### Current State

The centralized factory at `idea_to_graph_ontology/src/model.py` uses `ChatOpenAI` with configurable `base_url`:

```python
def get_llm(model=None, temperature=0.0) -> ChatOpenAI:
    model_name = model or os.getenv("LLM_MODEL", "deepseek-chat")
    kwargs = {"model": model_name, "temperature": temperature}
    base_url = os.getenv("LLM_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url
    api_key = os.getenv("LLM_API_KEY") or os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
    if api_key:
        kwargs["api_key"] = api_key
    return ChatOpenAI(**kwargs)
```

`ChatOpenAI` works with **any OpenAI-compatible API**. Switching providers requires only `.env` changes.

Similarly, `text_extract_ideas/src/model/model.py` uses the same pattern.

### OpenAI-Compatible Providers

| Provider | LLM_MODEL | LLM_BASE_URL | LLM_API_KEY |
|----------|-----------|-------------|-------------|
| DeepSeek (current) | `deepseek-chat` | `https://api.deepseek.com` | `sk-...` |
| OpenAI | `gpt-4o` | *(remove or leave empty)* | `sk-...` |
| Groq | `llama3-70b-8192` | `https://api.groq.com/openai/v1` | `gsk_...` |
| Together AI | `meta-llama/Meta-Llama-3-70B` | `https://api.together.xyz/v1` | `...` |
| Fireworks | `accounts/fireworks/models/llama-v3-70b` | `https://api.fireworks.ai/inference/v1` | `...` |
| xAI Grok | `grok-beta` | `https://api.x.ai/v1` | `...` |

### How to Switch

Edit `.env` (3 lines):

```env
LLM_MODEL=gpt-4o
LLM_BASE_URL=
LLM_API_KEY=sk-your-openai-key
```

The `LLM_BASE_URL` can be removed (empty) for standard OpenAI. The factory automatically detects this and omits `base_url` from the `ChatOpenAI` constructor.

### Non-OpenAI-Compatible Providers (e.g., Anthropic Claude)

For providers that don't support the OpenAI API format, you need to modify `src/model.py`:

```python
from langchain_anthropic import ChatAnthropic

def get_llm(model=None, temperature=0.0):
    model_name = model or os.getenv("LLM_MODEL", "claude-sonnet-4-6")
    if "claude" in model_name.lower():
        return ChatAnthropic(
            model=model_name,
            temperature=temperature,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )
    # ... existing ChatOpenAI logic
```

### JSON Mode / Structured Output

DeepSeek doesn't support LangChain's `with_structured_output()`. All pipeline modules use JSON-mode prompting instead (`parse_json_response()` in `model.py`). If you switch to a provider that supports `with_structured_output()` (OpenAI, Groq), you can optionally revert to structured output for better reliability:

```python
# Before (DeepSeek-compatible)
response = self.llm.invoke(messages)
data = parse_json_response(response.content)

# After (OpenAI, Groq)
structured_llm = self.llm.with_structured_output(MyModel)
result = structured_llm.invoke(messages)
```

### Verification

```bash
.venv/bin/python -c "
import sys; sys.path.insert(0, 'python_services')
from packages.ontology.src.model import get_llm
llm = get_llm()
print(f'Model: {llm.model_name}')
response = llm.invoke('Say hello in one word.')
print(f'Response: {response.content}')
"
```

---

## Summary: What Each Service Controls

| Service | Config Location | Switch Method |
|---------|----------------|---------------|
| SQLite → Supabase | `.env` `DATABASE_URL` | Uncomment connection string |
| Local GraphDB → Remote | Pipeline `--graph-endpoint` | Change URL |
| DeepSeek → Other LLM | `.env` `LLM_MODEL`/`LLM_BASE_URL`/`LLM_API_KEY` | Change 3 env vars |
| OpenAI key (structured output) | `.env` `OPENAI_API_KEY` | Update key value |
