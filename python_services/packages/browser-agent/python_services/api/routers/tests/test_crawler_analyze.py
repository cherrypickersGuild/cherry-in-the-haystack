"""
Tests for POST /crawler/analyze.

All DB calls and browser-use invocations are mocked — no real I/O.

Test coverage:
  5.1 — Unit tests for AnalysisJson Pydantic validator
  5.2 — Integration: cache-hit path (existing crawler_analysis row)
  5.3 — Integration: new analysis success path
  5.4 — Integration: browser-use failure → 422 with correct shape
  5.5 — Integration: timeout → 422 with TIMEOUT error
  5.6 — Integration: ValidationError from browser-use → 422 ANALYSIS_PARSE_FAILED
"""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from api.main import app
from api.models.crawler import AnalysisJson

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

_VALID_ANALYSIS_DATA = {
    "content_selector": ".post-list .post",
    "title_selector": ".post-title",
    "date_selector": ".post-date",
    "author_selector": ".post-author",
    "url_selector": ".post-title a",
    "body_selector": ".post-body",
    "pagination_type": "none",
    "dynamic_load": False,
    "notes": "Standard blog feed",
    "wait_for": None,
    "js_code": None,
    "magic_mode": False,
}

_SOURCE_ID = str(uuid.uuid4())
_ANALYSIS_ID = str(uuid.uuid4())
_RUN_LOG_ID = uuid.uuid4()


@pytest.fixture
async def client():
    """
    AsyncClient with mocked DB pool lifecycle so no real database is needed.
    """
    with (
        patch("api.db.client.init_pool", new=AsyncMock()),
        patch("api.db.client.close_pool", new=AsyncMock()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac


# ---------------------------------------------------------------------------
# 5.1 — Unit tests: AnalysisJson validator
# ---------------------------------------------------------------------------

class TestAnalysisJsonValidator:
    def test_all_valid_fields_accepted(self):
        model = AnalysisJson(**_VALID_ANALYSIS_DATA)
        assert model.pagination_type == "none"
        assert model.dynamic_load is False
        assert model.magic_mode is False
        assert model.wait_for is None
        assert model.js_code is None

    def test_invalid_pagination_type_rejected(self):
        bad = {**_VALID_ANALYSIS_DATA, "pagination_type": "hover"}
        with pytest.raises(ValidationError) as exc_info:
            AnalysisJson(**bad)
        assert "pagination_type" in str(exc_info.value).lower() or "literal" in str(exc_info.value).lower()

    def test_missing_required_selector_rejected(self):
        bad = {k: v for k, v in _VALID_ANALYSIS_DATA.items() if k != "title_selector"}
        with pytest.raises(ValidationError) as exc_info:
            AnalysisJson(**bad)
        assert "title_selector" in str(exc_info.value)

    def test_empty_selector_string_rejected(self):
        bad = {**_VALID_ANALYSIS_DATA, "content_selector": "   "}
        with pytest.raises(ValidationError):
            AnalysisJson(**bad)

    def test_all_nullable_crawl4ai_fields_optional(self):
        # wait_for, js_code default to None; magic_mode defaults to False
        minimal = {**_VALID_ANALYSIS_DATA}
        del minimal["wait_for"]
        del minimal["js_code"]
        del minimal["magic_mode"]
        model = AnalysisJson(**minimal)
        assert model.wait_for is None
        assert model.js_code is None
        assert model.magic_mode is False

    def test_magic_mode_can_be_true(self):
        data = {**_VALID_ANALYSIS_DATA, "magic_mode": True}
        model = AnalysisJson(**data)
        assert model.magic_mode is True

    def test_pagination_type_click_accepted(self):
        data = {**_VALID_ANALYSIS_DATA, "pagination_type": "click"}
        model = AnalysisJson(**data)
        assert model.pagination_type == "click"

    def test_pagination_type_scroll_accepted(self):
        data = {**_VALID_ANALYSIS_DATA, "pagination_type": "scroll"}
        model = AnalysisJson(**data)
        assert model.pagination_type == "scroll"


# ---------------------------------------------------------------------------
# 5.2 — Integration: cache-hit path
# ---------------------------------------------------------------------------

class TestCacheHitPath:
    async def test_returns_existing_analysis_without_browser_use(self, client):
        existing_row = {
            "id": uuid.UUID(_ANALYSIS_ID),
            "analysis_json": _VALID_ANALYSIS_DATA,
        }
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=existing_row)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock()) as mock_run_log,
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock()) as mock_browser,
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 200
        body = response.json()
        assert body["analysis_id"] == _ANALYSIS_ID
        assert body["analysis_json"]["content_selector"] == ".post-list .post"

        # AC2: no browser-use invocation and no run_log write on cache-hit
        mock_browser.assert_not_called()
        mock_run_log.assert_not_called()

    async def test_cache_hit_returns_all_analysis_json_fields(self, client):
        existing_row = {
            "id": uuid.UUID(_ANALYSIS_ID),
            "analysis_json": _VALID_ANALYSIS_DATA,
        }
        with patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=existing_row)):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        body = response.json()
        for field in ("content_selector", "title_selector", "date_selector",
                      "author_selector", "url_selector", "pagination_type",
                      "dynamic_load", "notes"):
            assert field in body["analysis_json"], f"Missing field: {field}"


# ---------------------------------------------------------------------------
# 5.3 — Integration: new analysis success path
# ---------------------------------------------------------------------------

class TestNewAnalysisSuccessPath:
    async def test_full_success_path_writes_db_and_returns_response(self, client):
        analysis_obj = AnalysisJson(**_VALID_ANALYSIS_DATA)
        returned_analysis_id = uuid.UUID(_ANALYSIS_ID)

        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock(return_value=analysis_obj)),
            patch("api.routers.crawler.db.get_or_create_prompt_version", new=AsyncMock(return_value=uuid.uuid4())),
            patch("api.routers.crawler.db.upsert_crawler_analysis", new=AsyncMock(return_value=returned_analysis_id)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update_log,
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 200
        body = response.json()
        assert body["analysis_id"] == _ANALYSIS_ID
        assert body["analysis_json"]["content_selector"] == ".post-list .post"
        # AC1: run_log updated to SUCCESS on success
        mock_update_log.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")

    async def test_upsert_called_with_source_id(self, client):
        analysis_obj = AnalysisJson(**_VALID_ANALYSIS_DATA)
        source_uuid = uuid.UUID(_SOURCE_ID)

        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock(return_value=analysis_obj)),
            patch("api.routers.crawler.db.get_or_create_prompt_version", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.upsert_crawler_analysis", new=AsyncMock(return_value=uuid.UUID(_ANALYSIS_ID))) as mock_upsert,
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        call_kwargs = mock_upsert.call_args.kwargs
        assert call_kwargs["source_id"] == source_uuid
        assert call_kwargs["analysis_json"] == _VALID_ANALYSIS_DATA

    async def test_run_log_created_with_crawler_analysis_kind(self, client):
        analysis_obj = AnalysisJson(**_VALID_ANALYSIS_DATA)

        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)) as mock_create_log,
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock(return_value=analysis_obj)),
            patch("api.routers.crawler.db.get_or_create_prompt_version", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.upsert_crawler_analysis", new=AsyncMock(return_value=uuid.UUID(_ANALYSIS_ID))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        mock_create_log.assert_called_once_with(run_kind="CRAWLER_ANALYSIS", status="RUNNING")


# ---------------------------------------------------------------------------
# 5.4 — Integration: browser-use failure → 422
# ---------------------------------------------------------------------------

class TestBrowserUseFailurePath:
    async def test_exception_returns_422_with_error_shape(self, client):
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis",
                  new=AsyncMock(side_effect=RuntimeError("Page load failed"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update_log,
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 422
        body = response.json()
        # AC3: error response shape
        assert "error" in body
        assert "detail" in body
        assert "Page load failed" in body["detail"]
        # AC3: run_log marked FAILED
        mock_update_log.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_no_partial_crawler_analysis_row_on_failure(self, client):
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis",
                  new=AsyncMock(side_effect=ValueError("Analysis failed"))),
            patch("api.routers.crawler.db.upsert_crawler_analysis", new=AsyncMock()) as mock_upsert,
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 422
        # AC3: UPSERT must NOT have been called (no partial write)
        mock_upsert.assert_not_called()

    async def test_invalid_json_output_returns_422(self, client):
        import json as _json
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis",
                  new=AsyncMock(side_effect=_json.JSONDecodeError("Expecting value", "", 0))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 422
        assert response.json()["error"] == "ANALYSIS_PARSE_FAILED"


# ---------------------------------------------------------------------------
# 5.5 — Integration: timeout → 422
# ---------------------------------------------------------------------------

class TestTimeoutPath:
    async def test_timeout_returns_422_with_timeout_error(self, client):
        async def _slow(*_args, **_kwargs):
            await asyncio.sleep(999)

        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis", new=_slow),
            patch("api.routers.crawler._ANALYZE_TIMEOUT", 0.01),  # force immediate timeout
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update_log,
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 422
        body = response.json()
        assert body["error"] == "TIMEOUT"
        assert "60" in body["detail"] or "time" in body["detail"].lower()
        # AC4: run_log written FAILED on timeout
        mock_update_log.assert_called_once_with(_RUN_LOG_ID, status="FAILED")


# ---------------------------------------------------------------------------
# 5.6 — Integration: ValidationError from browser-use → 422 ANALYSIS_PARSE_FAILED
# ---------------------------------------------------------------------------

def _make_validation_error():
    """Create a real pydantic ValidationError via an invalid AnalysisJson."""
    try:
        AnalysisJson(
            content_selector="   ",  # empty string → fails _non_empty_selector validator
            title_selector=".title",
            date_selector=".date",
            author_selector=".author",
            url_selector=".url",
            body_selector=".body",
            pagination_type="none",
            dynamic_load=False,
            notes="test",
        )
    except ValidationError as exc:
        return exc
    raise AssertionError("expected ValidationError to be raised")


class TestValidationErrorPath:
    async def test_validation_error_returns_422_with_analysis_parse_failed(self, client):
        ve = _make_validation_error()
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock(side_effect=ve)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        assert response.status_code == 422
        body = response.json()
        assert body["error"] == "ANALYSIS_PARSE_FAILED"
        assert "detail" in body

    async def test_validation_error_marks_run_log_failed(self, client):
        ve = _make_validation_error()
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock(side_effect=ve)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_validation_error_does_not_write_partial_analysis_row(self, client):
        ve = _make_validation_error()
        with (
            patch("api.routers.crawler.db.get_crawler_analysis", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._run_browser_use_analysis", new=AsyncMock(side_effect=ve)),
            patch("api.routers.crawler.db.upsert_crawler_analysis", new=AsyncMock()) as mock_upsert,
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/analyze", json={
                "source_id": _SOURCE_ID, "url": "https://example.com"
            })

        mock_upsert.assert_not_called()
