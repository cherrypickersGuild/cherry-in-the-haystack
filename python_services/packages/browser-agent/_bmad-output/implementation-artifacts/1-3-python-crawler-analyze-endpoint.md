# Story 1.3: Python /crawler/analyze Endpoint

**Status:** review
**Story ID:** 1.3
**Epic:** 1 — Source Onboarding Engine
**Created:** 2026-05-23

---

## Tasks / Subtasks

- [x] Task 1: Create Python FastAPI service skeleton
  - [x] 1.1 Create `python_services/api/main.py` — FastAPI app with lifespan (leave `app.state.browser_config` stub for Story 1.7)
  - [x] 1.2 Verify/create `python_services/requirements.txt` with `fastapi`, `uvicorn`, `browser-use`, `langchain-anthropic` (or `langchain-openai`), `asyncpg`, `python-uuid7`, `pydantic`
  - [x] 1.3 Create `python_services/api/routers/__init__.py` (empty)
  - [x] 1.4 Create `python_services/api/db/client.py` — async DB helpers for crawler_analysis UPSERT and run_log writes
- [x] Task 2: Define Pydantic models
  - [x] 2.1 Create `python_services/api/models/crawler.py` — `AnalyzeRequest`, `AnalysisJson`, `AnalyzeResponse`, `ErrorDetail`
  - [x] 2.2 Add application-level validator for `analysis_json` — all 11 required fields present, `pagination_type` in {none, click, scroll}
- [x] Task 3: Implement `POST /crawler/analyze` endpoint in `python_services/api/routers/crawler.py`
  - [x] 3.1 Cache-check path: query `content.crawler_analysis WHERE source_id = $1`; return existing `analysis_id` + `analysis_json` immediately (no browser-use, no run_log)
  - [x] 3.2 Analysis path: INSERT `core.run_log` row (`run_kind = 'CRAWLER_ANALYSIS'`, `status = 'running'`) → capture `run_log_id`
  - [x] 3.3 Invoke browser-use `Agent` with the CRAWLER_ANALYSIS prompt against the URL
  - [x] 3.4 Parse agent output → validate full `analysis_json` shape
  - [x] 3.5 UPSERT `content.crawler_analysis`: INSERT ... ON CONFLICT (source_id) DO UPDATE SET all fields
  - [x] 3.6 UPDATE `core.run_log` → status `'COMPLETED'` on success; `'FAILED'` on any exception
  - [x] 3.7 On any error: 422 `{"error": "<TYPE>", "detail": "<message>"}` — zero partial DB writes on failure path
  - [x] 3.8 Wire 60-second timeout via `asyncio.wait_for`
- [x] Task 4: Create CRAWLER_ANALYSIS prompt template
  - [x] 4.1 Create `python_services/api/prompts/crawler_analysis.py` — versioned prompt constant
  - [x] 4.2 Prompt must instruct browser-use to return structured JSON with all 11 fields and specify magic_mode heuristics
  - [x] 4.3 Implement `get_or_create_prompt_version()` helper that looks up or inserts into `core.prompt_template_version` and returns the `id`
- [x] Task 5: Write tests
  - [x] 5.1 Unit test `analysis_json` validator — all required fields, invalid pagination_type, missing fields
  - [x] 5.2 Integration test cache-hit path: pre-existing `crawler_analysis` row → no browser-use call, correct response shape
  - [x] 5.3 Integration test analysis path: mock `Agent.run()` return → assert DB UPSERT, run_log writes, response fields
  - [x] 5.4 Integration test error path: browser-use raises → assert 422 shape, run_log status `'FAILED'`, no crawler_analysis row written
  - [x] 5.5 Test timeout: `asyncio.wait_for` fires → assert 422 response

---

## User Story

As an engineer,
I want a `POST /crawler/analyze` endpoint that uses browser-use to analyze any target URL and stores the structured result in `crawler_analysis`,
So that the system can understand a page's content structure once and reuse that knowledge for Python crawl4ai crawler generation.

---

## Acceptance Criteria

**AC1 — New analysis (no prior record):**
**Given** a valid `POST /crawler/analyze` request with `source_id` and `url`
**When** the endpoint is called and no existing `crawler_analysis` row exists for `source_id`
**Then** browser-use loads and renders the target URL
**And** the AI identifies: primary content area, pagination/load-more patterns, and field locations for title, body, date, author, and URL
**And** the result is stored as a new `crawler_analysis` row (UPSERT on `source_id`)
**And** the response contains `analysis_id` and `analysis_json` with all required fields: `content_selector`, `title_selector`, `date_selector`, `author_selector`, `url_selector`, `pagination_type` (none/click/scroll), `dynamic_load` (boolean), `notes`
**And** `analysis_json` also includes crawl4ai execution hints: `wait_for` (CSS/JS condition or null), `js_code` (JS snippet or null), `magic_mode` (boolean) — derived by browser-use during the same analysis pass (ADR-011-R1)
**And** a `core.run_log` entry is written with `run_kind = 'CRAWLER_ANALYSIS'` and the final status

**AC2 — Cache-hit path (prior record exists):**
**Given** a `POST /crawler/analyze` request for a `source_id` that already has a `crawler_analysis` row
**When** the endpoint is called
**Then** the endpoint returns the existing `analysis_id` and `analysis_json` without invoking browser-use
**And** no new `run_log` entry is written (NFR-1 cost guard)

**AC3 — browser-use failure:**
**Given** browser-use fails to load or analyze the target URL
**When** the endpoint is called
**Then** a 422 response is returned with `{"error": "<type>", "detail": "<message>"}`
**And** the `run_log` entry is written with `status = 'FAILED'`
**And** no partial `crawler_analysis` row is written

**AC4 — Timeout:**
**Given** the endpoint request
**When** it does not complete within 60 seconds
**Then** the request times out with a 422 error response

**AC5 — Prompt version FK:**
**Given** a stored `crawler_analysis` row
**When** it is inspected
**Then** `prompt_template_version_id` links to the exact prompt version used during analysis (FR-2.5)

---

## Dev Notes

### CRITICAL: Workspace Pattern

Same as Stories 1.1 and 1.2 — the `python_services/` and `cherry-in-the-haystack` repos are NOT present here. **Create all files in logical paths in this workspace that mirror target repo locations.** No Python files exist in `python_services/` yet — you are building the entire Python service skeleton.

### Python FastAPI Service Structure (NEW — create all of these)

```
python_services/
  requirements.txt
  api/
    main.py                     # FastAPI app + lifespan
    routers/
      __init__.py               # empty
      crawler.py                # POST /crawler/analyze (this story)
    models/
      crawler.py                # Pydantic request/response models
    db/
      client.py                 # asyncpg helpers
    prompts/
      crawler_analysis.py       # versioned prompt template
```

### `main.py` — FastAPI App with Lifespan

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .routers import crawler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Story 1.7 will attach BrowserConfig singleton here:
    # app.state.browser_config = BrowserConfig(headless=True, verbose=False)
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(crawler.router)
```

**IMPORTANT:** Do not create the `BrowserConfig` singleton in this story — that belongs to Story 1.7 (`/crawler/execute`). Just set up the lifespan scaffold so Story 1.7 can extend it without modifying this story's code.

### Pydantic Models (`python_services/api/models/crawler.py`)

```python
from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from uuid import UUID

class AnalyzeRequest(BaseModel):
    source_id: UUID
    url: str

class AnalysisJson(BaseModel):
    # FR-2.4 required fields
    content_selector: str
    title_selector: str
    date_selector: str
    author_selector: str
    url_selector: str
    pagination_type: Literal["none", "click", "scroll"]
    dynamic_load: bool
    notes: str
    # ADR-011-R1 crawl4ai execution hints
    wait_for: Optional[str] = None
    js_code: Optional[str] = None
    magic_mode: bool = False

class AnalyzeResponse(BaseModel):
    analysis_id: UUID
    analysis_json: AnalysisJson

class ErrorDetail(BaseModel):
    error: str
    detail: str
```

### Endpoint Implementation (`python_services/api/routers/crawler.py`)

```python
import asyncio
import json
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request
from ..models.crawler import AnalyzeRequest, AnalyzeResponse, AnalysisJson, ErrorDetail

router = APIRouter(prefix="/crawler", tags=["crawler"])

ANALYZE_TIMEOUT_SECONDS = 60

@router.post("/analyze", response_model=AnalyzeResponse,
             responses={422: {"model": ErrorDetail}})
async def analyze_source(req: AnalyzeRequest, request: Request):
    # AC2: cache-hit — return existing without browser-use or run_log
    existing = await db.get_crawler_analysis(req.source_id)
    if existing:
        return AnalyzeResponse(
            analysis_id=existing["id"],
            analysis_json=AnalysisJson(**existing["analysis_json"]),
        )

    # AC1: new analysis — write run_log, invoke browser-use, UPSERT
    run_log_id = await db.create_run_log(run_kind="CRAWLER_ANALYSIS", status="running")
    try:
        analysis_json = await asyncio.wait_for(
            _run_browser_use_analysis(req.url),
            timeout=ANALYZE_TIMEOUT_SECONDS,
        )
        prompt_version_id = await db.get_or_create_prompt_version("CRAWLER_ANALYSIS")
        analysis_id = await db.upsert_crawler_analysis(
            source_id=req.source_id,
            analysis_json=analysis_json.model_dump(),
            prompt_template_version_id=prompt_version_id,
            run_log_id=run_log_id,
            model_name=_model_name(),
        )
        await db.update_run_log(run_log_id, status="COMPLETED")
        return AnalyzeResponse(analysis_id=analysis_id, analysis_json=analysis_json)
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        raise HTTPException(status_code=422, detail={"error": "TIMEOUT", "detail": "Analysis exceeded 60s limit"})
    except Exception as e:
        await db.update_run_log(run_log_id, status="FAILED")
        raise HTTPException(status_code=422, detail={"error": "ANALYSIS_FAILED", "detail": str(e)})
```

**CRITICAL:** On any exception path — no partial `crawler_analysis` row must exist. The UPSERT only fires after `_run_browser_use_analysis` succeeds.

### Browser-use Integration

```python
from browser_use import Agent
from langchain_anthropic import ChatAnthropic  # or langchain_openai
import json

async def _run_browser_use_analysis(url: str) -> AnalysisJson:
    llm = ChatAnthropic(model="claude-3-5-sonnet-20241022")
    agent = Agent(
        task=CRAWLER_ANALYSIS_PROMPT.format(url=url),
        llm=llm,
    )
    history = await agent.run()
    # Extract final result from agent history
    raw_output = history.final_result()   # returns the last agent response string
    analysis_dict = json.loads(raw_output)
    return AnalysisJson(**analysis_dict)
```

**Notes on browser-use `Agent` API:**
- `Agent(task=str, llm=BaseChatModel)` — task is the full prompt string
- `await agent.run()` returns `AgentHistoryList`
- `history.final_result()` returns the agent's last extracted result string
- The LLM model env var: `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`)
- Per-request browser instances (no singleton) — acceptable for analyze since frequency is ≤1×/source/stable period (NFR-1)
- **Check the actual installed version** in requirements.txt/pyproject.toml of cherry-in-the-haystack before writing import paths — API changed between 0.1.x and 0.2.x

### CRAWLER_ANALYSIS Prompt Template

```python
# python_services/api/prompts/crawler_analysis.py

PROMPT_NAME = "CRAWLER_ANALYSIS"
PROMPT_VERSION = "1.0.0"

CRAWLER_ANALYSIS_PROMPT = """
Navigate to {url} and analyze the page structure for web crawling.

Return ONLY a valid JSON object (no markdown, no explanation) with these exact fields:

{{
  "content_selector": "<CSS selector for the container holding article/post list>",
  "title_selector": "<CSS selector for individual article titles>",
  "date_selector": "<CSS selector for publication dates>",
  "author_selector": "<CSS selector for author names>",
  "url_selector": "<CSS selector for article URLs>",
  "pagination_type": "<none|click|scroll>",
  "dynamic_load": <true|false>,
  "notes": "<brief description of page structure and any quirks>",
  "wait_for": "<CSS/JS wait condition string, or null>",
  "js_code": "<JS snippet to run post-load, or null>",
  "magic_mode": <true|false>
}}

Rules:
- content_selector: outermost container holding the repeating list of articles/posts
- pagination_type: "none"=single page, "click"=load-more button, "scroll"=infinite scroll
- dynamic_load: true if article content loads asynchronously after initial DOM ready
- wait_for: If dynamic_load=true, set a specific CSS selector (e.g. "css:.article-list") or JS expression (e.g. "js:()=>window.loaded===true"); null if not needed
- js_code: Only set if scroll trigger needed (e.g. "window.scrollTo(0, document.body.scrollHeight)"); null otherwise
- magic_mode: true if you detect Cloudflare challenge, DataDome, or other bot-detection (403, empty body, JS challenge page)
- All selectors must be valid CSS selectors that target elements on THIS specific page
"""
```

### DB Client (`python_services/api/db/client.py`)

Use `asyncpg` for async PostgreSQL — match cherry-in-the-haystack's existing DB connection pattern. Key operations needed:

```python
# Connection pool — initialize in lifespan or via module-level pool
# Use DATABASE_URL env var (match existing convention)

async def get_crawler_analysis(source_id: UUID) -> dict | None:
    # SELECT id, analysis_json FROM content.crawler_analysis WHERE source_id = $1
    pass

async def upsert_crawler_analysis(
    source_id: UUID,
    analysis_json: dict,
    prompt_template_version_id: UUID | None,
    run_log_id: UUID | None,
    model_name: str | None,
) -> UUID:
    # INSERT INTO content.crawler_analysis (id, source_id, analysis_json, ...)
    # ON CONFLICT (source_id) DO UPDATE SET
    #   analysis_json = EXCLUDED.analysis_json,
    #   prompt_template_version_id = EXCLUDED.prompt_template_version_id,
    #   run_log_id = EXCLUDED.run_log_id,
    #   model_name = EXCLUDED.model_name,
    #   updated_at = CURRENT_TIMESTAMP
    # RETURNING id
    pass

async def create_run_log(run_kind: str, status: str) -> UUID:
    # INSERT INTO core.run_log (id, run_kind, status, created_at, updated_at)
    # RETURNING id
    # CRITICAL: check actual core.run_log schema in cherry-in-the-haystack DDL
    pass

async def update_run_log(run_log_id: UUID, status: str) -> None:
    # UPDATE core.run_log SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1
    pass

async def get_or_create_prompt_version(prompt_name: str) -> UUID | None:
    # SELECT id FROM core.prompt_template_version WHERE name = $1 ORDER BY created_at DESC LIMIT 1
    # If not found: INSERT and return new id
    # Returns None if core.prompt_template_version table doesn't exist yet
    pass
```

**CRITICAL — UUID v7:** Use `uuid7` Python package (`import uuid7; uuid7.uuid7()`) for all new `id` fields. Verify if `python-uuid7` or `uuid7` package name is used in the target repo first.

**CRITICAL — core.run_log schema:** The exact column list for `core.run_log` is in `cherry-in-the-haystack/docs/architecture/ddl-v1.1.sql`. Before writing insert logic, inspect that file for correct column names (likely `id`, `run_kind`, `status`, `started_at`/`completed_at` or `created_at`/`updated_at`). Do NOT guess column names.

**CRITICAL — core.prompt_template_version schema:** Same — inspect DDL for correct columns before writing insert/select. This table may have `name`, `version`, `content`, `hash` columns. The story only needs to store a reference; if the table doesn't yet have the prompt content stored, insert a minimal row and return its id.

### `analysis_json` Full Contract (ADR-011-R1)

The 11-field shape that must be produced by browser-use and stored in the JSONB column:

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `content_selector` | string | ✅ | Container of article list |
| `title_selector` | string | ✅ | Individual article title |
| `date_selector` | string | ✅ | Publication date element |
| `author_selector` | string | ✅ | Author name element |
| `url_selector` | string | ✅ | Article URL link |
| `pagination_type` | "none"\|"click"\|"scroll" | ✅ | Pagination style |
| `dynamic_load` | boolean | ✅ | Async content loading |
| `notes` | string | ✅ | Page structure observations |
| `wait_for` | string\|null | ✅ (nullable) | crawl4ai wait condition |
| `js_code` | string\|null | ✅ (nullable) | crawl4ai post-load JS |
| `magic_mode` | boolean | ✅ | Bot-detection bypass flag |

The DB-level CHECK (`chk_crawler_analysis_json_is_object`) only validates it is a JSONB object. **Application-level validation (Pydantic `AnalysisJson` model) is the real contract enforcer.**

### Error Response Shape

FastAPI's default 422 response shape conflicts with the AC requirement. Override it:

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@router.post("/analyze")
async def analyze_source(req: AnalyzeRequest):
    ...
    # On error, return:
    return JSONResponse(
        status_code=422,
        content={"error": "ANALYSIS_FAILED", "detail": str(e)}
    )
```

Error type strings to use:
- `"TIMEOUT"` — asyncio.TimeoutError
- `"BROWSER_LOAD_FAILED"` — browser-use cannot load the URL
- `"ANALYSIS_PARSE_FAILED"` — agent output is not valid JSON or missing required fields
- `"ANALYSIS_FAILED"` — any other exception

### 60-Second Timeout

```python
import asyncio

# Wrap the browser-use call
try:
    result = await asyncio.wait_for(
        _run_browser_use_analysis(url),
        timeout=60.0,
    )
except asyncio.TimeoutError:
    # treat as TIMEOUT error
```

FastAPI endpoint functions are async — `asyncio.wait_for` works directly without extra threads.

### UPSERT SQL (verbatim)

```sql
INSERT INTO content.crawler_analysis
    (id, source_id, analysis_json, prompt_template_version_id, run_log_id, model_name)
VALUES
    ($1, $2, $3::jsonb, $4, $5, $6)
ON CONFLICT (source_id) DO UPDATE SET
    analysis_json              = EXCLUDED.analysis_json,
    prompt_template_version_id = EXCLUDED.prompt_template_version_id,
    run_log_id                 = EXCLUDED.run_log_id,
    model_name                 = EXCLUDED.model_name,
    updated_at                 = CURRENT_TIMESTAMP
RETURNING id
```

The `ON CONFLICT (source_id)` matches the unique index `uq_crawler_analysis_source` from Story 1.1. Do not use ON CONFLICT ON CONSTRAINT — the unique index name is the right target.

### Testing Strategy

Use `pytest` + `pytest-asyncio`. Mock the database layer and `Agent.run()`:

```python
# Patch browser-use at the module level, not the Agent class globally
@patch("python_services.api.routers.crawler._run_browser_use_analysis")
async def test_analyze_new_source(mock_run, ...):
    mock_run.return_value = AnalysisJson(content_selector=".posts", ...)
    # Assert DB writes, response shape
```

Test file location: `python_services/api/routers/tests/test_crawler_analyze.py`

**No real DB calls in tests.** Mock `db.get_crawler_analysis`, `db.upsert_crawler_analysis`, `db.create_run_log`, `db.update_run_log`.

### Environment Variables

```
DATABASE_URL=postgresql+asyncpg://...   # async DB connection
ANTHROPIC_API_KEY=...                   # for ChatAnthropic LLM
# or OPENAI_API_KEY if using ChatOpenAI
```

Do not hardcode any credentials. Follow existing env var pattern from cherry-in-the-haystack.

---

## Previous Story Intelligence (Stories 1.1 + 1.2 Learnings)

**Workspace delivery pattern:**
- Create files at their logical target paths in this workspace (e.g., `python_services/api/...`)
- No cherry-in-the-haystack repo is accessible — deliver standalone files with clear placement notes
- This is the FIRST Python file delivery — you are building the service skeleton from scratch

**From Story 1.1 (DB migration):**
- `content.crawler_analysis` table exists with UPSERT-safe unique index on `source_id`
- `content.crawler_status_enum` and `core.run_kind_enum` extensions already applied
- UUID v7 is the PK standard — use a UUID v7 generator, not `uuid.uuid4()`
- `core.run_log` schema: check `ddl-v1.1.sql` before writing INSERT — column names matter
- `core.prompt_template_version` schema: check DDL before writing

**From Story 1.2 (TypeScript config loader):**
- Validate library exists before importing — check requirements.txt for `browser-use`, `asyncpg`, `pydantic`
- Do NOT introduce new dependencies without confirming availability
- Fail fast on missing/invalid config (throw, don't silently degrade)

**Code review findings to carry forward:**
- Be explicit about Python version requirements if using walrus operator or match/case syntax
- Include `asyncpg` connection pool lifecycle in lifespan — don't create per-request connections

---

## Architecture Compliance Checklist

- [x] Python file naming: `lowercase_underscores.py`
- [x] Router file at `python_services/api/routers/crawler.py`
- [x] FastAPI app at `python_services/api/main.py` with lifespan scaffold for Story 1.7
- [x] `POST /crawler/analyze` returns `{ analysis_id, analysis_json }` on success
- [x] Error response shape: `422 { "error": string, "detail": string }` (not FastAPI default)
- [x] Cache-hit path: no browser-use invocation, no run_log write (AC2 / NFR-1)
- [x] 60-second timeout via `asyncio.wait_for`
- [x] UPSERT on `source_id` (not blind INSERT)
- [x] run_log written with `CRAWLER_ANALYSIS` kind; status updated on both success and failure
- [x] `prompt_template_version_id` FK populated on successful analysis
- [x] Zero partial `crawler_analysis` rows on error path
- [x] No hardcoded credentials — env vars only (NFR-5)
- [x] UUID v7 for all new primary keys
- [x] All 11 `analysis_json` fields validated by Pydantic before DB write
- [x] Tests mock DB and browser-use — no real I/O

---

## File List

- `python_services/requirements.txt` — NEW: Python dependencies
- `python_services/api/main.py` — NEW: FastAPI app + lifespan scaffold
- `python_services/requirements.txt` — NEW: Python service dependencies
- `python_services/pytest.ini` — NEW: asyncio_mode=auto, testpaths=api
- `python_services/conftest.py` — NEW: sys.path fixture so tests can import from `api.*`
- `python_services/api/__init__.py` — NEW: package marker
- `python_services/api/main.py` — NEW: FastAPI app + lifespan (init_pool, Story 1.7 browser_config stub)
- `python_services/api/models/__init__.py` — NEW: package marker
- `python_services/api/models/crawler.py` — NEW: AnalyzeRequest, AnalysisJson (with field_validator), AnalyzeResponse, ErrorDetail
- `python_services/api/prompts/__init__.py` — NEW: package marker
- `python_services/api/prompts/crawler_analysis.py` — NEW: CRAWLER_ANALYSIS_PROMPT, PROMPT_NAME, PROMPT_VERSION
- `python_services/api/db/__init__.py` — NEW: package marker
- `python_services/api/db/client.py` — NEW: asyncpg pool + get_crawler_analysis, upsert_crawler_analysis, create_run_log, update_run_log, get_or_create_prompt_version
- `python_services/api/routers/__init__.py` — NEW: package marker
- `python_services/api/routers/crawler.py` — NEW: POST /crawler/analyze, _run_browser_use_analysis, _extract_json
- `python_services/api/routers/tests/__init__.py` — NEW: package marker
- `python_services/api/routers/tests/test_crawler_analyze.py` — NEW: 17 passing pytest tests

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- uuid7 PyPI package installs as `uuid_extensions` module (not `uuid7`). Fixed import to use `from uuid_extensions import uuid7`.
- All DB and browser-use calls are mocked in tests via `patch("api.routers.crawler.db.*")` — no real I/O required.
- Timeout test uses `patch("api.routers.crawler._ANALYZE_TIMEOUT", 0.01)` to force immediate timeout without real sleep.

### Completion Notes List

- AC1 ✅ New analysis path: run_log INSERT → browser-use Agent → AnalysisJson validation → UPSERT crawler_analysis → run_log UPDATE COMPLETED
- AC2 ✅ Cache-hit path: existing row returned immediately, no browser-use invocation, no run_log write
- AC3 ✅ Error path: any exception → run_log FAILED, 422 `{"error": ..., "detail": ...}`, no partial crawler_analysis row
- AC4 ✅ Timeout: `asyncio.wait_for` with 60s limit → 422 `{"error": "TIMEOUT", ...}` + run_log FAILED
- AC5 ✅ prompt_template_version_id: `get_or_create_prompt_version()` called with PROMPT_NAME, PROMPT_VERSION, prompt content
- 17 tests pass across all 5 test categories (AnalysisJson validator, cache-hit, success path, failure path, timeout)
- FastAPI lifespan scaffold ready for Story 1.7's BrowserConfig singleton (stub comment in place)
- `_extract_json()` handles markdown-fenced and bare JSON from browser-use agent output

### Change Log

| Date | Change |
|------|--------|
| 2026-05-23 | Story created — comprehensive developer guide for POST /crawler/analyze endpoint |
| 2026-05-23 | Implementation complete — 15 files delivered, 17 tests passing; status → review |

---

*Implementation complete. All ACs satisfied and all tasks checked.*
