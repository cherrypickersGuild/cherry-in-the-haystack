# Story 1.4: Python /crawler/generate Endpoint

**Status:** review
**Story ID:** 1.4
**Epic:** 1 ??Source Onboarding Engine
**Created:** 2026-05-23

---

## Tasks / Subtasks

- [x] Task 1: Add Pydantic models for generate endpoint
  - [x] 1.1 Add `GenerateRequest` to `python_services/api/models/crawler.py` ??fields: `source_id: UUID`, `analysis_id: UUID`, `source_name: str`
  - [x] 1.2 Add `GenerateResponse` to `python_services/api/models/crawler.py` ??fields: `registry_id: UUID`, `generated_code: str`
- [x] Task 2: Add DB helpers to `python_services/api/db/client.py`
  - [x] 2.1 `get_crawler_analysis_by_id(analysis_id: UUID) -> Optional[dict]` ??`SELECT id, analysis_json FROM content.crawler_analysis WHERE id = $1`
  - [x] 2.2 `insert_crawler_registry(source_id, analysis_id, generated_code, run_log_id) -> UUID` ??pure INSERT with `status='pending_review'` (not UPSERT)
- [x] Task 3: Implement `POST /crawler/generate` in `python_services/api/routers/crawler.py`
  - [x] 3.1 Add `_GENERATE_TIMEOUT: float = 30.0` constant (patchable, same pattern as `_ANALYZE_TIMEOUT`)
  - [x] 3.2 Write `_generate_crawler_script(analysis_json: AnalysisJson, source_name: str) -> str` ??pure template rendering, NO LLM
  - [x] 3.3 Endpoint flow: INSERT run_log ??load analysis_json ??render script ??INSERT crawler_registry ??UPDATE run_log COMPLETED ??return JSONResponse
  - [x] 3.4 Error path: UPDATE run_log FAILED ??return JSONResponse 422 `{"error": ..., "detail": ...}` ??no partial crawler_registry row
  - [x] 3.5 Wrap the generate logic in `asyncio.wait_for(..., timeout=_GENERATE_TIMEOUT)`
- [x] Task 4: Write tests
  - [x] 4.1 Unit test `_generate_crawler_script()` ??valid analysis_json produces correct EXTRACTION_SCHEMA dict, correct CRAWL_CONFIG (with/without wait_for and js_code, magic_mode True/False)
  - [x] 4.2 Integration test success path: mock DB helpers and _generate_crawler_script ??assert run_log writes, registry INSERT, response shape
  - [x] 4.3 Integration test error path: DB fetch raises ??assert 422 shape, run_log FAILED, no registry row written
  - [x] 4.4 Integration test timeout: mock _generate_crawler_script slow ??assert 422 TIMEOUT, run_log FAILED
  - [x] 4.5 Unit test generated script has no hardcoded credentials (no `sk-`, no `eyJ`, no `password=`)

---

## User Story

As an engineer,
I want a `POST /crawler/generate` endpoint that takes a page analysis result and generates a Python crawl4ai crawler script,
So that I receive production-ready, human-readable crawler code without writing it manually.

---

## Acceptance Criteria

**AC1 ??Success path:**
**Given** a valid `POST /crawler/generate` request with `source_id`, `analysis_id`, and `source_name`
**When** the endpoint is called
**Then** the endpoint loads `analysis_json` from `crawler_analysis` for the given `analysis_id`
**And** maps the selector fields to a `JsonCssExtractionStrategy` schema (baseSelector, fields for title/url/date/author/content)
**And** renders a Python crawl4ai script from template, populating `wait_for`, `js_code`, and `magic_mode` from `analysis_json` (ADR-013-R1)
**And** the generated script is stored as a new `content.crawler_registry` row with `status = 'pending_review'` and `generated_code = <Python script>`
**And** the response contains `registry_id` and `generated_code`
**And** a `core.run_log` entry is written with `run_kind = 'CRAWLER_GENERATION'`

**AC2 ??Script structure:**
**Given** the generated Python crawl4ai script
**When** it is reviewed
**Then** it contains a `EXTRACTION_SCHEMA` dict and a `CRAWL_CONFIG = CrawlerRunConfig(...)` object as the top-level exports
**And** it contains no hardcoded credentials or secrets ??all auth uses env var references (NFR-5)
**And** the code is human-readable Python that a reviewer can assess for correctness in under 10 minutes (NFR-4)

**AC3 ??Null fields omitted:**
**Given** the analysis_json has `wait_for = null` and `js_code = null`
**When** the script is generated
**Then** those parameters are omitted from `CrawlerRunConfig` (not set to `None` explicitly)

**AC4 ??Error path:**
**Given** the endpoint cannot generate a valid script from the analysis input
**When** the endpoint is called
**Then** a 422 response is returned with `{"error": "<type>", "detail": "<message>"}`
**And** the `run_log` entry is written with `status = 'FAILED'`
**And** no `crawler_registry` row is written

**AC5 ??Timeout:**
**Given** the endpoint request
**When** it does not complete within 30 seconds
**Then** the request times out with a 422 error response

---

## Dev Notes

### Files to Touch (UPDATE, not new)

```
python_services/
  api/
    models/crawler.py          UPDATE ??add GenerateRequest, GenerateResponse
    db/client.py               UPDATE ??add get_crawler_analysis_by_id, insert_crawler_registry
    routers/crawler.py         UPDATE ??add POST /crawler/generate endpoint + helpers
    routers/tests/
      test_crawler_generate.py NEW ??pytest tests for generate endpoint
```

**Do NOT touch:** `main.py`, `prompts/`, `conftest.py`, any existing test file.

### Model Additions (`python_services/api/models/crawler.py`)

Append to the existing file ??do NOT modify existing classes:

```python
class GenerateRequest(BaseModel):
    source_id: UUID
    analysis_id: UUID
    source_name: str

class GenerateResponse(BaseModel):
    registry_id: UUID
    generated_code: str
```

### DB Helper Additions (`python_services/api/db/client.py`)

Append to the existing file. Use `_new_uuid()` (already defined in the file) for new PKs.

```python
async def get_crawler_analysis_by_id(analysis_id: UUID) -> Optional[dict]:
    """Return analysis row by PK, or None."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, analysis_json FROM content.crawler_analysis WHERE id = $1",
            analysis_id,
        )
    if row is None:
        return None
    return {"id": row["id"], "analysis_json": dict(row["analysis_json"])}


async def insert_crawler_registry(
    source_id: UUID,
    analysis_id: Optional[UUID],
    generated_code: str,
    run_log_id: Optional[UUID],
) -> UUID:
    """
    INSERT a new crawler_registry row with status='pending_review'.
    NOT an upsert ??multiple pending_review rows for the same source are allowed.
    The partial unique index only covers status='active'.
    """
    pool = _get_pool()
    new_id = _new_uuid()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO content.crawler_registry
                (id, source_id, analysis_id, status, generated_code, run_log_id)
            VALUES ($1, $2, $3, 'pending_review', $4, $5)
            """,
            new_id,
            source_id,
            analysis_id,
            generated_code,
            run_log_id,
        )
    return new_id
```

### Endpoint Addition (`python_services/api/routers/crawler.py`)

Add after the existing `/analyze` endpoint and its helpers. Reuse `_ANALYZE_TIMEOUT` pattern:

```python
from ..models.crawler import AnalysisJson, AnalyzeRequest, GenerateRequest  # extend imports

_GENERATE_TIMEOUT: float = 30.0


@router.post("/generate")
async def generate_crawler(req: GenerateRequest) -> JSONResponse:
    run_log_id = await db.create_run_log(run_kind="CRAWLER_GENERATION", status="running")
    try:
        generated_code = await asyncio.wait_for(
            _do_generate(req.analysis_id, req.source_name),
            timeout=_GENERATE_TIMEOUT,
        )
        registry_id = await db.insert_crawler_registry(
            source_id=req.source_id,
            analysis_id=req.analysis_id,
            generated_code=generated_code,
            run_log_id=run_log_id,
        )
        await db.update_run_log(run_log_id, status="COMPLETED")
        return JSONResponse(content={
            "registry_id": str(registry_id),
            "generated_code": generated_code,
        })
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "TIMEOUT", "detail": "Generation exceeded 30-second time limit"},
        )
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )


async def _do_generate(analysis_id: UUID, source_name: str) -> str:
    """Load analysis from DB and render the crawl4ai Python script."""
    row = await db.get_crawler_analysis_by_id(analysis_id)
    if row is None:
        raise ValueError(f"No crawler_analysis found for analysis_id={analysis_id}")
    analysis_json = AnalysisJson(**row["analysis_json"])
    return _generate_crawler_script(analysis_json, source_name)


def _generate_crawler_script(analysis_json: AnalysisJson, source_name: str) -> str:
    """
    Pure template rendering ??no LLM, no I/O.
    Renders a crawl4ai Python script from analysis_json selectors.
    wait_for and js_code are OMITTED (not set to None) when null ??per AC3.
    """
    kebab_name = _to_kebab_case(source_name)
    # Build CrawlerRunConfig kwargs dynamically ??omit null optional fields
    crawl_config_kwargs = [
        "    extraction_strategy=JsonCssExtractionStrategy(EXTRACTION_SCHEMA),",
    ]
    if analysis_json.wait_for is not None:
        crawl_config_kwargs.append(f'    wait_for={analysis_json.wait_for!r},')
    if analysis_json.js_code is not None:
        crawl_config_kwargs.append(f'    js_code={analysis_json.js_code!r},')
    crawl_config_kwargs.append(f'    magic={analysis_json.magic_mode},')
    crawl_config_kwargs.append('    cache_mode="bypass",')

    return f'''\
# python_services/crawlers/generated/{kebab_name}.py
# Generated by /crawler/generate ??do not edit manually.

from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
from crawl4ai import CrawlerRunConfig

EXTRACTION_SCHEMA = {{
    "name": {source_name!r},
    "baseSelector": {analysis_json.content_selector!r},
    "fields": [
        {{"name": "title",   "selector": {analysis_json.title_selector!r},  "type": "text"}},
        {{"name": "url",     "selector": {analysis_json.url_selector!r},    "type": "attribute", "attribute": "href"}},
        {{"name": "date",    "selector": {analysis_json.date_selector!r},   "type": "attribute", "attribute": "datetime"}},
        {{"name": "author",  "selector": {analysis_json.author_selector!r}, "type": "text"}},
        {{"name": "content", "selector": {analysis_json.content_selector!r},"type": "text"}},
    ]
}}

CRAWL_CONFIG = CrawlerRunConfig(
{chr(10).join(crawl_config_kwargs)}
)
'''


def _to_kebab_case(name: str) -> str:
    """Convert source name to kebab-case filename (e.g. 'Tech Crunch' ??'tech-crunch')."""
    import re
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip()).strip("-").lower()
    return slug
```

### CRITICAL: run_log is written BEFORE the generate logic

Unlike the analyze endpoint where run_log is created before browser-use, here run_log is created at the top before any other logic. This means:
- On `asyncio.TimeoutError` ??UPDATE run_log FAILED
- On any other exception ??UPDATE run_log FAILED  
- On DB fetch returning None ??`_do_generate` raises ValueError ??caught by general `except Exception` ??run_log FAILED, 422 returned, no registry row written

### CRITICAL: No registry row on any failure path

The `insert_crawler_registry` call happens **after** `asyncio.wait_for` completes successfully. If `_do_generate` raises or times out, no registry row is written (same pattern as no partial `crawler_analysis` row in `/analyze`).

### CRITICAL: `wait_for` and `js_code` omission (AC3)

The generated script must NOT contain `wait_for=None` or `js_code=None` in `CrawlerRunConfig`. These kwargs must be conditionally included only when non-null. The `_generate_crawler_script` implementation above handles this correctly via the `crawl_config_kwargs` list.

Test this with a unit test specifically checking the absence of `wait_for` and `js_code` kwargs when null.

### CRITICAL: `insert_crawler_registry` is a pure INSERT, NOT upsert

The `content.crawler_registry` partial unique index only covers `WHERE status = 'active'`. Multiple `pending_review` rows for the same `source_id` are allowed. Do NOT add ON CONFLICT clause. Story 1.5 handles duplicate PR cleanup at the TypeScript layer.

### Error Response Shape

Same contract as `/analyze` ??return `JSONResponse` directly, not raise `HTTPException`:

```python
return JSONResponse(
    status_code=422,
    content={"error": "SomeType", "detail": "message here"}
)
```

Error type strings to use:
- `"TIMEOUT"` ??asyncio.TimeoutError
- `"ValueError"` ??analysis_id not found in DB (from _do_generate)
- `type(exc).__name__` ??any other exception

### Testing Pattern (`test_crawler_generate.py`)

Follow `test_crawler_analyze.py` exactly ??same fixture, same mock patch paths:

```python
@pytest.fixture
async def client():
    with (
        patch("api.db.client.init_pool", new=AsyncMock()),
        patch("api.db.client.close_pool", new=AsyncMock()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
```

Mock patch paths for the generate endpoint:
- `api.routers.crawler.db.create_run_log`
- `api.routers.crawler.db.update_run_log`
- `api.routers.crawler.db.get_crawler_analysis_by_id`
- `api.routers.crawler.db.insert_crawler_registry`
- `api.routers.crawler._generate_crawler_script`  ??for integration tests
- `api.routers.crawler._GENERATE_TIMEOUT` ??for timeout test (patch to 0.01)

Unit tests for `_generate_crawler_script` call it directly ??no mocking needed:

```python
from api.routers.crawler import _generate_crawler_script
from api.models.crawler import AnalysisJson

_VALID_ANALYSIS = AnalysisJson(
    content_selector=".post-list",
    title_selector=".post-title a",
    date_selector=".post-date",
    author_selector=".post-author",
    url_selector=".post-title a",
    pagination_type="none",
    dynamic_load=False,
    notes="test",
    wait_for=None,
    js_code=None,
    magic_mode=False,
)

def test_wait_for_omitted_when_null():
    script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
    assert "wait_for" not in script

def test_js_code_omitted_when_null():
    script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
    assert "js_code" not in script

def test_wait_for_included_when_set():
    analysis = _VALID_ANALYSIS.model_copy(update={"wait_for": "css:.article-list"})
    script = _generate_crawler_script(analysis, "Test Source")
    assert "wait_for" in script
    assert "css:.article-list" in script

def test_magic_mode_in_crawl_config():
    analysis = _VALID_ANALYSIS.model_copy(update={"magic_mode": True})
    script = _generate_crawler_script(analysis, "Test Source")
    assert "magic=True" in script

def test_extraction_schema_has_all_fields():
    script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
    for field in ("title", "url", "date", "author", "content"):
        assert f'"name": "{field}"' in script

def test_no_hardcoded_credentials():
    script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
    import re
    assert not re.search(r"(sk-|eyJ|password\s*=\s*['\"])", script)
```

### Import Changes to `crawler.py`

Add to existing imports:
```python
from ..models.crawler import AnalysisJson, AnalyzeRequest, GenerateRequest
```

Remove `AnalyzeRequest` from any existing import if it conflicts (check current imports at top of file: `from ..models.crawler import AnalysisJson, AnalyzeRequest`). Add `GenerateRequest` to the same import line.

---

## Previous Story Intelligence (Story 1.3 Learnings)

**UUID pattern established:** `from uuid_extensions import uuid7 as _uuid7_fn` (PyPI `uuid7` package installs as `uuid_extensions` module). The fallback chain and `_new_uuid()` helper are already in `db/client.py`.

**JSONResponse pattern:** All responses are `JSONResponse(content={...})` ??NOT Pydantic `response_model=` on the router decorator. This is the established pattern from `/analyze`.

**Timeout constant pattern:** `_ANALYZE_TIMEOUT: float = 60.0` is a module-level patchable constant. Mirror exactly with `_GENERATE_TIMEOUT: float = 30.0`.

**asyncpg JSONB:** When inserting into JSONB columns, pass `json.dumps(dict_value)` as a string parameter. The `generated_code` column is TEXT, not JSONB ??no `json.dumps()` needed for the script string.

**run_log enum cast:** The existing `create_run_log` uses `$2::core.run_kind_enum` cast. `CRAWLER_GENERATION` is already added to the enum in Story 1.1 migration. No schema change needed.

**Test file location:** `python_services/api/routers/tests/test_crawler_generate.py` ??follow the same `__init__.py` package structure (already exists at `python_services/api/routers/tests/__init__.py`).

**Mock depth:** Patch `api.routers.crawler.db.*` (not `api.db.client.*`) since the router imports the client module as `from ..db import client as db`.

---

## Architecture Compliance Checklist

- [x] Python file naming: `lowercase_underscores.py`
- [x] Route added to existing `python_services/api/routers/crawler.py` ??NOT a new router file
- [x] `POST /crawler/generate` returns `{ registry_id, generated_code }` on success
- [x] Error response shape: `422 { "error": string, "detail": string }` (JSONResponse, not FastAPI default)
- [x] 30-second timeout via `asyncio.wait_for` with `_GENERATE_TIMEOUT` constant
- [x] `INSERT` crawler_registry (not UPSERT ??partial unique index only on `status='active'`)
- [x] `status = 'pending_review'` on new registry row
- [x] run_log written with `CRAWLER_GENERATION` kind; status updated on both success and failure
- [x] `wait_for` and `js_code` omitted (not None) from CrawlerRunConfig when null in analysis_json
- [x] Zero `crawler_registry` rows on error path
- [x] No hardcoded credentials ??env vars only (NFR-5)
- [x] UUID v7 for all new primary keys via `_new_uuid()`
- [x] Script contains `EXTRACTION_SCHEMA` dict and `CRAWL_CONFIG` as top-level module exports
- [x] Tests mock DB and script generation ??no real I/O

---

## File List

- `python_services/api/models/crawler.py` ??UPDATE: add `GenerateRequest`, `GenerateResponse`
- `python_services/api/db/client.py` ??UPDATE: add `get_crawler_analysis_by_id`, `insert_crawler_registry`
- `python_services/api/routers/crawler.py` ??UPDATE: add `POST /crawler/generate`, `_do_generate`, `_generate_crawler_script`, `_to_kebab_case`, `_GENERATE_TIMEOUT`
- `python_services/api/routers/tests/test_crawler_generate.py` ??NEW: pytest tests

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `!r` repr on selector strings produced single-quoted Python strings; fixed by using `json.dumps()` for all string values in the generated script to ensure double-quoted output consistent with the architecture template.
- Timeout test originally patched `_generate_crawler_script` (sync) with an async `side_effect`, which raised RuntimeError instead of TimeoutError. Fixed by patching `_do_generate` (the async wrapper) so `asyncio.wait_for` can observe the slow coroutine.

### Completion Notes List

- AC1 ??Success path: run_log INSERT (CRAWLER_GENERATION) ??load analysis_json by analysis_id ??render Python crawl4ai script ??INSERT crawler_registry (pending_review) ??run_log COMPLETED ??JSONResponse {registry_id, generated_code}
- AC2 ??Script contains `EXTRACTION_SCHEMA` dict and `CRAWL_CONFIG = CrawlerRunConfig(...)` as top-level exports; no hardcoded credentials
- AC3 ??`wait_for` and `js_code` omitted from CrawlerRunConfig when null (not set to None); verified by two dedicated unit tests
- AC4 ??Error path: any exception ??run_log FAILED ??422 {"error", "detail"}, no crawler_registry row written
- AC5 ??30-second timeout via `asyncio.wait_for` with patchable `_GENERATE_TIMEOUT = 30.0` constant
- 46 total tests pass (17 existing analyze tests + 29 new generate tests), zero regressions

### Change Log

| Date | Change |
|------|--------|
| 2026-05-23 | Story created ??comprehensive developer guide for POST /crawler/generate endpoint |
| 2026-05-23 | Implementation complete ??4 files changed, 29 tests added (46 total pass); status ??review |
