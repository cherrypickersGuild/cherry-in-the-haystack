# Story 1.7: Python /crawler/execute Endpoint

**Status:** review
**Story ID:** 1.7
**Epic:** 1 ??Source Onboarding Engine
**Created:** 2026-05-24

---

## Tasks / Subtasks

- [x] Task 1: Add `crawl4ai` dependency (AC2, AC1)
  - [x] 1.1 Add `crawl4ai>=0.4.0` to `python_services/requirements.txt`
- [x] Task 2: Add DB helper `get_active_crawler_registry` (AC1, AC3)
  - [x] 2.1 Implement `get_active_crawler_registry(source_id)` in `db/client.py` ??SELECT with JOIN to `content.source` to also return `source_url`
- [x] Task 3: Add Pydantic models for execute endpoint (AC1)
  - [x] 3.1 Add `ExecuteRequest`, `CrawledItem`, `ExecuteResponse` to `models/crawler.py`
- [x] Task 4: Implement BrowserConfig singleton in lifespan (AC2)
  - [x] 4.1 Replace placeholder comment in `main.py` lifespan with deferred `from crawl4ai import BrowserConfig` + `app.state.browser_config = BrowserConfig(headless=True, verbose=False)`
- [x] Task 5: Implement `POST /crawler/execute` endpoint (AC1?“AC7)
  - [x] 5.1 Add `Request` to fastapi imports in `routers/crawler.py`
  - [x] 5.2 Add `_NoActiveCrawlerError` sentinel exception class
  - [x] 5.3 Implement `_load_crawl_config_from_code(generated_code)` ??exec-based loader that injects crawl4ai symbols into namespace and extracts `CRAWL_CONFIG`
  - [x] 5.4 Implement `_parse_crawl_result(result)` ??maps crawl4ai `CrawlResult` fields (`title`, `url`, `date`, `author`, `content`) to API response shape (`title`, `url`, `published_at`, `author`, `body`, `canonical_url`)
  - [x] 5.5 Implement `_do_execute(source_id, browser_config)` ??DB lookup ??load config ??`AsyncWebCrawler.arun()` ??parse; raises `_NoActiveCrawlerError` on missing registry; raises `ValueError` on zero items
  - [x] 5.6 Implement the `@router.post("/execute")` handler with 30s `asyncio.wait_for` timeout, run_log lifecycle (CRAWLER_EXECUTION), and error shape `{"error": ..., "detail": ...}`
- [x] Task 6: Write pytest tests (AC1?“AC7)
  - [x] 6.1 Create `python_services/api/routers/tests/test_crawler_execute.py`
  - [x] 6.2 Test: success path ??registry found, items returned, run_log COMPLETED (AC1, AC7)
  - [x] 6.3 Test: BrowserConfig instantiated once during lifespan, not per-request (AC2)
  - [x] 6.4 Test: no active registry ??422 `NO_ACTIVE_CRAWLER` + run_log FAILED (AC3, AC7)
  - [x] 6.5 Test: crawl4ai returns zero items ??422 + run_log FAILED (AC4, AC7)
  - [x] 6.6 Test: timeout ??422 `TIMEOUT` + run_log FAILED (AC5, AC7)
  - [x] 6.7 Test: response shape ??`source_id` + `items` with all 6 fields (AC1)
  - [x] 6.8 Test: run_log created with `run_kind="CRAWLER_EXECUTION"` on both success and failure (AC7)

---

## User Story

As an engineer,
I want a `POST /crawler/execute` endpoint that runs the active crawl4ai crawler for a source and returns structured article data,
so that the TypeScript scheduler can collect content from any source via a single HTTP call without managing browser lifecycle directly.

---

## Acceptance Criteria

**AC1 ??Happy path execution:**
**Given** a valid `POST /crawler/execute` request with `source_id`
**When** the endpoint is called and an `active` `crawler_registry` row exists for that source
**Then** the endpoint loads `generated_code` from the active `crawler_registry` row
**And** dynamically imports `CRAWL_CONFIG` from the generated Python module
**And** runs `AsyncWebCrawler(config=app.state.browser_config).arun(url, config=CRAWL_CONFIG)`
**And** returns `{ "source_id": string, "items": CrawledItem[] }` where each item contains `title`, `body`, `published_at`, `author`, `url`, `canonical_url`

**AC2 ??BrowserConfig singleton:**
**Given** the FastAPI app starts up
**When** the lifespan context manager executes
**Then** a single `BrowserConfig(headless=True)` instance is created and attached to `app.state.browser_config`
**And** this instance is reused across all `/crawler/execute` requests (no per-request browser spawn)

**AC3 ??No active crawler:**
**Given** a `POST /crawler/execute` request
**When** no `active` `crawler_registry` row exists for the `source_id`
**Then** a 422 response is returned: `{"error": "NO_ACTIVE_CRAWLER", "detail": "..."}`

**AC4 ??crawl4ai failure or zero items:**
**Given** crawl4ai fails to load the page or extraction returns zero items
**When** the endpoint processes the result
**Then** a 422 response is returned with `{"error": "<type>", "detail": "<message>"}`
**And** no partial results are returned

**AC5 ??Timeout:**
**Given** the endpoint request
**When** it does not complete within 30 seconds
**Then** the request times out with a 422 error response: `{"error": "TIMEOUT", "detail": "..."}`

**AC6 ??Magic mode:**
**Given** the generated Python module has `magic=True` in `CRAWL_CONFIG`
**When** the endpoint runs the crawler
**Then** crawl4ai's stealth mode is active for that request (bot-detection bypass)

**AC7 ??Run log:**
**Given** the endpoint executes (success or failure)
**When** the run completes
**Then** a `core.run_log` entry is written with `run_kind = 'CRAWLER_EXECUTION'` and the final status

---

## Dev Notes

### File Structure

```
python_services/
  requirements.txt                              ??MODIFY: add crawl4ai>=0.4.0
  api/
    main.py                                     ??MODIFY: activate BrowserConfig singleton in lifespan
    models/
      crawler.py                                ??MODIFY: add ExecuteRequest, CrawledItem, ExecuteResponse
    db/
      client.py                                 ??MODIFY: add get_active_crawler_registry()
    routers/
      crawler.py                                ??MODIFY: add /execute endpoint + helpers
      tests/
        test_crawler_execute.py                 ??NEW: tests for /crawler/execute
```

**Do NOT touch:** existing test files (`test_crawler_analyze.py`, `test_crawler_generate.py`), `conftest.py`, `prompts/crawler_analysis.py`.

---

### Dependency: Add crawl4ai to requirements.txt

```
crawl4ai>=0.4.0
```

Add after the existing `browser-use` line. The `AsyncWebCrawler`, `BrowserConfig`, `CrawlerRunConfig` APIs are stable in 0.4.x.

---

### DB Helper ??`get_active_crawler_registry` in `db/client.py`

Add this function after `insert_crawler_registry`. It must JOIN to `content.source` to get `url` (the `crawler_registry` table only stores `source_id`, not the URL directly):

```python
async def get_active_crawler_registry(source_id: UUID) -> Optional[dict]:
    """
    Return the active crawler_registry row + source URL for source_id, or None.
    JOIN with content.source to fetch the crawl target URL.
    """
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT r.id, r.generated_code, s.url AS source_url
            FROM content.crawler_registry r
            JOIN content.source s ON s.id = r.source_id
            WHERE r.source_id = $1 AND r.status = 'active'
            LIMIT 1
            """,
            source_id,
        )
    if row is None:
        return None
    return {
        "id": row["id"],
        "generated_code": row["generated_code"],
        "source_url": row["source_url"],
    }
```

---

### Pydantic Models ??`models/crawler.py`

Add these three classes at the end of the file:

```python
class ExecuteRequest(BaseModel):
    source_id: UUID


class CrawledItem(BaseModel):
    title: str
    body: str
    published_at: str
    author: str
    url: str
    canonical_url: str


class ExecuteResponse(BaseModel):
    source_id: UUID
    items: list[CrawledItem]
```

---

### main.py ??Activate BrowserConfig Singleton

Replace the placeholder comment block (lines 27??9) with:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool(os.environ["DATABASE_URL"])
    from crawl4ai import BrowserConfig          # deferred import ??allows test patching
    app.state.browser_config = BrowserConfig(headless=True, verbose=False)
    yield
    await close_pool()
```

The deferred import inside the function body (matching the pattern of `_run_browser_use_analysis`) means tests can patch `"crawl4ai.BrowserConfig"` without issues during module load.

---

### `/crawler/execute` Endpoint ??`routers/crawler.py`

**New imports to add at top of file:**
```python
from fastapi import APIRouter, Request          # add Request to existing import
```

**Add these components after the existing `/generate` implementation:**

```python
# ---------------------------------------------------------------------------
# POST /crawler/execute
# ---------------------------------------------------------------------------

_EXECUTE_TIMEOUT: float = 30.0


class _NoActiveCrawlerError(Exception):
    """Raised when no active crawler_registry row exists for the requested source."""


@router.post("/execute")
async def execute_crawler(req: ExecuteRequest, request: Request) -> JSONResponse:
    run_log_id = await db.create_run_log(run_kind="CRAWLER_EXECUTION", status="running")
    try:
        items = await asyncio.wait_for(
            _do_execute(req.source_id, request.app.state.browser_config),
            timeout=_EXECUTE_TIMEOUT,
        )
        await db.update_run_log(run_log_id, status="COMPLETED")
        return JSONResponse(content={
            "source_id": str(req.source_id),
            "items": items,
        })
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "TIMEOUT", "detail": "Execution exceeded 30-second time limit"},
        )
    except _NoActiveCrawlerError as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "NO_ACTIVE_CRAWLER", "detail": str(exc)},
        )
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )


async def _do_execute(source_id: UUID, browser_config) -> list[dict]:
    """Load active crawler, run it, return parsed items list."""
    from crawl4ai import AsyncWebCrawler  # deferred import

    registry = await db.get_active_crawler_registry(source_id)
    if registry is None:
        raise _NoActiveCrawlerError(f"No active crawler found for source_id={source_id}")

    crawl_config = _load_crawl_config_from_code(registry["generated_code"])

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=registry["source_url"], config=crawl_config)

    items = _parse_crawl_result(result)
    if not items:
        raise ValueError("Crawler returned zero items ??full-run failure")
    return items


def _load_crawl_config_from_code(generated_code: str):
    """
    Execute generated_code string in an isolated namespace and return CRAWL_CONFIG.
    Injects crawl4ai symbols so the generated imports resolve correctly.
    """
    from crawl4ai import CrawlerRunConfig
    from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

    namespace: dict = {
        "CrawlerRunConfig": CrawlerRunConfig,
        "JsonCssExtractionStrategy": JsonCssExtractionStrategy,
    }
    exec(compile(generated_code, "<generated>", "exec"), namespace)  # noqa: S102
    crawl_config = namespace.get("CRAWL_CONFIG")
    if crawl_config is None:
        raise ValueError("Generated code does not define CRAWL_CONFIG")
    return crawl_config


def _parse_crawl_result(result) -> list[dict]:
    """
    Map crawl4ai CrawlResult extracted_content to the CrawledItem API shape.
    JsonCssExtractionStrategy returns JSON array with field names matching the schema.
    """
    import json as _json

    if not result.success:
        raise ValueError(f"Crawl failed: {result.error_message or 'unknown error'}")
    if not result.extracted_content:
        return []
    raw_items = _json.loads(result.extracted_content)
    return [
        {
            "title": item.get("title", ""),
            "body": item.get("content", ""),        # schema field "content" ??body
            "published_at": item.get("date", ""),   # schema field "date" ??published_at
            "author": item.get("author", ""),
            "url": item.get("url", ""),
            "canonical_url": item.get("url", ""),   # no canonical in CSS extraction; fallback
        }
        for item in raw_items
    ]
```

**Also add `ExecuteRequest` to the import from models:**
```python
from ..models.crawler import AnalysisJson, AnalyzeRequest, ExecuteRequest, GenerateRequest
```

---

### Testing Pattern ??`test_crawler_execute.py`

Match the structure of existing test files exactly:
- `pytest-asyncio` with `asyncio_mode = auto` (already in pytest.ini)
- `patch("api.db.client.init_pool", new=AsyncMock())` in the client fixture
- Patch `"crawl4ai.BrowserConfig"` to prevent real browser spawning
- For integration tests: patch `api.routers.crawler._do_execute` directly (same pattern as patching `_do_generate` in generate tests)
- For the BrowserConfig singleton test: patch `crawl4ai.BrowserConfig` + make two requests ??assert called once

**Client fixture for execute tests:**

```python
@pytest.fixture
async def client():
    mock_browser_config = MagicMock()
    with (
        patch("api.db.client.init_pool", new=AsyncMock()),
        patch("api.db.client.close_pool", new=AsyncMock()),
        patch("crawl4ai.BrowserConfig", return_value=mock_browser_config),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            ac.app_state = mock_browser_config   # for reference in tests if needed
            yield ac
```

**Key test cases with mock shape:**

```python
# Happy path (AC1, AC7)
_FAKE_ITEMS = [
    {"title": "T1", "content": "Body1", "date": "2026-01-01", "author": "A", "url": "https://x.com/1"},
]

async def test_success_returns_items(client):
    with (
        patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
        patch("api.routers.crawler._do_execute", new=AsyncMock(return_value=_MAPPED_ITEMS)),
        patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
    ):
        response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})
    assert response.status_code == 200
    body = response.json()
    assert body["source_id"] == _SOURCE_ID
    assert len(body["items"]) == 1
    assert set(body["items"][0].keys()) >= {"title", "body", "published_at", "author", "url", "canonical_url"}
    mock_update.assert_called_once_with(_RUN_LOG_ID, status="COMPLETED")

# No active crawler (AC3)
async def test_no_active_crawler_returns_422(client):
    with (
        patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
        patch("api.routers.crawler._do_execute",
              new=AsyncMock(side_effect=_NoActiveCrawlerError("No active crawler found..."))),
        patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
    ):
        response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})
    assert response.status_code == 422
    assert response.json()["error"] == "NO_ACTIVE_CRAWLER"
    mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

# Timeout (AC5)
async def test_timeout_returns_422(client):
    async def _slow(*_a, **_kw): await asyncio.sleep(999)
    with (
        patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
        patch("api.routers.crawler._do_execute", new=_slow),
        patch("api.routers.crawler._EXECUTE_TIMEOUT", 0.01),
        patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
    ):
        response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})
    assert response.status_code == 422
    assert response.json()["error"] == "TIMEOUT"
    mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")
```

**Unit tests for `_parse_crawl_result`:**

```python
from api.routers.crawler import _parse_crawl_result

def test_parse_maps_content_to_body():
    mock_result = MagicMock(success=True, extracted_content='[{"title":"T","content":"B","date":"2026","author":"A","url":"http://x"}]')
    items = _parse_crawl_result(mock_result)
    assert items[0]["body"] == "B"
    assert items[0]["published_at"] == "2026"

def test_parse_returns_empty_list_on_no_extracted_content():
    mock_result = MagicMock(success=True, extracted_content=None)
    assert _parse_crawl_result(mock_result) == []

def test_parse_raises_on_crawl_failure():
    mock_result = MagicMock(success=False, error_message="Page not found")
    with pytest.raises(ValueError, match="Crawl failed"):
        _parse_crawl_result(mock_result)
```

**Import of `_NoActiveCrawlerError` in test file:**
```python
from api.routers.crawler import _NoActiveCrawlerError, _parse_crawl_result
```

---

### Architecture Compliance Checklist

- [x] File naming: `test_crawler_execute.py` ??snake_case, matches existing test files
- [x] Router file: extend `python_services/api/routers/crawler.py` ??do NOT create a new router file
- [x] `browser_config` comes from `request.app.state` ??never instantiated per-request (AC2)
- [x] `AsyncWebCrawler` used via async context manager ??`async with AsyncWebCrawler(...) as crawler`
- [x] All crawl4ai imports are deferred (inside function bodies) ??prevents import-time failures in tests
- [x] `exec()` is used only for trusted internally-generated code (generated by `/crawler/generate`) ??not user input
- [x] `_EXECUTE_TIMEOUT = 30.0` as module-level constant (patchable in tests, matching `_GENERATE_TIMEOUT` pattern)
- [x] Error shape: `{"error": str, "detail": str}` for all 422s ??consistent with analyze and generate endpoints
- [x] `run_kind="CRAWLER_EXECUTION"` ??matches the enum value added in Story 1.1 migration (`ADD VALUE 'CRAWLER_EXECUTION'` ??**verify this is in the 1.1 migration before deploying**)
- [x] No `canonical_url` from CSS extraction ??fallback to `url` value (CSS strategy doesn't produce canonical)
- [x] `_parse_crawl_result` uses `item.get("content", "")` for `body` (the generated schema names this field `"content"`, not `"body"`)

---

### Critical Constraints

**`CRAWLER_EXECUTION` enum value:** Story 1.1 AC says `core.run_kind_enum` gets both `CRAWLER_ANALYSIS` and `CRAWLER_GENERATION`. The epics text also mentions `CRAWLER_EXECUTION` in Story 1.1 AC. Verify the Story 1.1 migration file includes `ALTER TYPE core.run_kind_enum ADD VALUE 'CRAWLER_EXECUTION'` before deploying Story 1.7 ??if absent, the `create_run_log` INSERT will fail.

**`content.source.url` column name:** The DB query in `get_active_crawler_registry` assumes `content.source` has a column named `url`. Verify against `cherry-in-the-haystack/docs/architecture/ddl-v1.1.sql` before deploying.

**crawl4ai `CrawlResult` API:** The result object fields (`result.success`, `result.error_message`, `result.extracted_content`) are assumed from the crawl4ai 0.4.x public API. If the installed version differs, verify these field names. The `_parse_crawl_result` function is the only place that touches the raw result object.

**`exec()` + crawl4ai symbol injection:** `_load_crawl_config_from_code` pre-populates the exec namespace with `CrawlerRunConfig` and `JsonCssExtractionStrategy`. The generated script's `from crawl4ai import ...` statements will be re-executed inside exec but the namespace already has these symbols ??exec will overwrite them with the same values, which is safe. If crawl4ai adds new symbols the generated code imports, those imports will fail inside exec unless also pre-injected.

---

### Previous Story Intelligence (Story 1.6 Learnings)

- Python test pattern: `patch("api.routers.crawler.db.<func>")` for all DB mock patches (not `api.db.client.<func>`) ??the router imports `db` as an alias
- `patch("api.routers.crawler._do_generate", new=_slow)` works for patching internal async helpers ??use same pattern for `_do_execute`
- `patch("api.routers.crawler._GENERATE_TIMEOUT", 0.01)` works for forcing timeout ??use `_EXECUTE_TIMEOUT` same way
- `asyncio_mode = auto` in pytest.ini means test methods can be `async def` without `@pytest.mark.asyncio`
- `httpx.ASGITransport(app=app)` + `AsyncClient(transport=..., base_url="http://test")` is the standard fixture shape
- `_VALID_ANALYSIS_DATA` dict defined at module level with all 12 fields ??reuse for `_VALID_ANALYSIS_DICT` in execute tests if needed (the execute endpoint doesn't need analysis data directly, but `_parse_crawl_result` unit tests need mock CrawlResult objects)

---

## File List

- `python_services/requirements.txt` ??MODIFY: add `crawl4ai>=0.4.0`
- `python_services/api/main.py` ??MODIFY: activate BrowserConfig singleton in lifespan
- `python_services/api/models/crawler.py` ??MODIFY: add `ExecuteRequest`, `CrawledItem`, `ExecuteResponse`
- `python_services/api/db/client.py` ??MODIFY: add `get_active_crawler_registry(source_id)`
- `python_services/api/routers/crawler.py` ??MODIFY: add `/execute` endpoint, `_NoActiveCrawlerError`, `_do_execute`, `_load_crawl_config_from_code`, `_parse_crawl_result`
- `python_services/api/routers/tests/test_crawler_execute.py` ??NEW: full test suite for `/crawler/execute`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **crawl4ai not installed in test env**: `patch("crawl4ai.BrowserConfig")` fails because `crawl4ai` is not importable. Fixed by not patching BrowserConfig at all in the HTTP client fixture ??`ASGITransport` does not run FastAPI lifespan, so BrowserConfig is never called. Set `app.state.browser_config = MagicMock()` directly instead.
- **`KeyError: DATABASE_URL` in lifespan tests**: Lifespan runs `os.environ["DATABASE_URL"]` as a function argument. Fixed by adding `patch.dict(os.environ, {"DATABASE_URL": "postgresql://test/db"})` to all direct lifespan invocations.
- **`socket.gaierror` in lifespan tests**: `patch("api.db.client.init_pool")` patches the wrong reference ??`api.main` has already imported `init_pool` into its own namespace. Fixed by patching `api.main.init_pool` and `api.main.close_pool` instead.

### Completion Notes List

- All 6 tasks and 8 subtasks implemented and verified. 29/29 new tests pass.
- `/crawler/execute` endpoint follows exact same pattern as `/crawler/generate`: run_log lifecycle, 30s timeout via `asyncio.wait_for`, consistent 422 error shape.
- `BrowserConfig` singleton activated in `main.py` lifespan with deferred import. Reused via `request.app.state.browser_config` in every execute call.
- `get_active_crawler_registry` JOINs `content.source` to retrieve the target URL (registry table only stores `source_id`).
- `_load_crawl_config_from_code` uses `exec()` with pre-injected crawl4ai symbols so generated code's `from crawl4ai import ...` statements resolve correctly without requiring a real module import at exec time.
- Field mapping: crawl4ai schema `"content"` ??API `"body"`, `"date"` ??`"published_at"`, `"url"` ??both `"url"` and `"canonical_url"` (CSS extraction has no canonical URL).
- Pre-existing failures in `test_crawler_analyze.py` (2 tests asserting `content_selector == ".post-list"` vs fixture `.post-list .post`) are NOT regressions from this story ??confirmed present before any Story 1.7 changes.
- Full regression suite: 74 passed, 2 pre-existing failures (unrelated to this story).

### Change Log

| Date | Change |
|------|--------|
| 2026-05-24 | Story created ??comprehensive developer guide for Python /crawler/execute endpoint implementation |
| 2026-05-24 | Implementation complete ??all tasks done, 29 tests pass, status ??review |
