"""
Tests for POST /crawler/fallback.

All DB calls and browser-use invocations are mocked — no real I/O.

Test coverage:
  5.1 — Success path: returns 200 with source_id and items array
  5.2 — run_log written with CRAWLER_FALLBACK kind on success and failure
  5.3 — Timeout → 422 TIMEOUT + run_log FAILED
  5.4 — Browser-use failure → 422 + run_log FAILED
  5.5 — Empty result → 200 with items: [] (empty page is not an error)
  5.6 — Response shape: source_id + items with 6-field objects
  Unit — _parse_fallback_result() parsing and edge cases
"""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.routers.crawler import _parse_fallback_result

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

_SOURCE_ID = str(uuid.uuid4())
_RUN_LOG_ID = uuid.uuid4()
_URL = "https://example.com/feed"

_MAPPED_ITEMS = [
    {
        "title": "Article One",
        "body": "Body content here",
        "published_at": "2026-01-15",
        "author": "Jane Doe",
        "url": "https://example.com/article-1",
        "canonical_url": "https://example.com/article-1",
    }
]

_REQUEST_BODY = {"source_id": _SOURCE_ID, "url": _URL}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def client():
    """
    AsyncClient with mocked DB pool lifecycle.
    ASGITransport does not run the FastAPI lifespan, so app.state.browser_config
    is set directly to a MagicMock to satisfy the fallback endpoint.
    """
    mock_browser_config = MagicMock()
    app.state.browser_config = mock_browser_config
    with (
        patch("api.db.client.init_pool", new=AsyncMock()),
        patch("api.db.client.close_pool", new=AsyncMock()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    try:
        del app.state.browser_config
    except AttributeError:
        pass


# ---------------------------------------------------------------------------
# 5.1 — Success path
# ---------------------------------------------------------------------------

class TestFallbackSuccessPath:
    async def test_success_returns_200_with_source_id_and_items(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 200
        body = response.json()
        assert body["source_id"] == _SOURCE_ID
        assert len(body["items"]) == 1
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")

    async def test_success_run_log_completed(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            await client.post("/crawler/fallback", json=_REQUEST_BODY)

        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")


# ---------------------------------------------------------------------------
# 5.2 — run_log written with CRAWLER_FALLBACK kind
# ---------------------------------------------------------------------------

class TestRunLogKind:
    async def test_run_log_created_with_crawler_fallback_kind_on_success(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)) as mock_create,
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/fallback", json=_REQUEST_BODY)

        mock_create.assert_called_once_with(run_kind="CRAWLER_FALLBACK", status="RUNNING")

    async def test_run_log_created_with_crawler_fallback_kind_on_failure(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)) as mock_create,
            patch("api.routers.crawler._do_fallback",
                  new=AsyncMock(side_effect=RuntimeError("browser-use failed"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/fallback", json=_REQUEST_BODY)

        mock_create.assert_called_once_with(run_kind="CRAWLER_FALLBACK", status="RUNNING")

    async def test_run_log_failed_on_general_exception(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback",
                  new=AsyncMock(side_effect=RuntimeError("unexpected"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 422
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")


# ---------------------------------------------------------------------------
# 5.3 — Timeout → 422 TIMEOUT
# ---------------------------------------------------------------------------

class TestTimeoutPath:
    async def test_timeout_returns_422_with_timeout_error(self, client):
        async def _slow(*_args, **_kwargs):
            await asyncio.sleep(999)

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=_slow),
            patch("api.routers.crawler._FALLBACK_TIMEOUT", 0.01),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 422
        body = response.json()
        assert body["error"] == "TIMEOUT"
        assert "60" in body["detail"] or "time" in body["detail"].lower()
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")


# ---------------------------------------------------------------------------
# 5.4 — Browser-use failure → 422 + run_log FAILED
# ---------------------------------------------------------------------------

class TestBrowserUseFailure:
    async def test_browser_use_failure_returns_422(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback",
                  new=AsyncMock(side_effect=ValueError("Browser-use agent returned an empty result"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 422
        body = response.json()
        assert "error" in body
        assert "detail" in body
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_runtime_error_returns_422(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback",
                  new=AsyncMock(side_effect=RuntimeError("connection refused"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 422

    async def test_no_partial_results_on_failure(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback",
                  new=AsyncMock(side_effect=RuntimeError("Partial extraction"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 422
        assert "items" not in response.json()


# ---------------------------------------------------------------------------
# 5.5 — Empty result → 200 with items: []
# ---------------------------------------------------------------------------

class TestEmptyResult:
    async def test_empty_result_returns_200_not_error(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=[])),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 200
        body = response.json()
        assert body["items"] == []
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")

    async def test_empty_result_run_log_completed(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=[])),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            await client.post("/crawler/fallback", json=_REQUEST_BODY)

        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")


# ---------------------------------------------------------------------------
# 5.6 — Response shape
# ---------------------------------------------------------------------------

class TestResponseShape:
    async def test_response_has_source_id_and_items(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) >= {"source_id", "items"}

    async def test_item_has_all_six_fields(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        item = response.json()["items"][0]
        assert set(item.keys()) >= {"title", "body", "published_at", "author", "url", "canonical_url"}

    async def test_source_id_in_response_matches_request(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        assert response.json()["source_id"] == _SOURCE_ID

    async def test_error_response_has_error_and_detail_keys(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_fallback",
                  new=AsyncMock(side_effect=RuntimeError("boom"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/fallback", json=_REQUEST_BODY)

        body = response.json()
        assert set(body.keys()) >= {"error", "detail"}
        assert isinstance(body["error"], str)
        assert isinstance(body["detail"], str)


# ---------------------------------------------------------------------------
# Unit tests — _parse_fallback_result()
# ---------------------------------------------------------------------------

class TestParseFallbackResult:
    def test_parses_plain_json_array(self):
        raw = '[{"title":"T","body":"B","published_at":"2026","author":"A","url":"http://x","canonical_url":"http://x"}]'
        items = _parse_fallback_result(raw)
        assert len(items) == 1
        assert items[0]["title"] == "T"
        assert items[0]["body"] == "B"

    def test_parses_markdown_fenced_json(self):
        raw = '```json\n[{"title":"T","body":"B","published_at":"2026","author":"A","url":"http://x","canonical_url":"http://x"}]\n```'
        items = _parse_fallback_result(raw)
        assert len(items) == 1
        assert items[0]["title"] == "T"

    def test_parses_markdown_fenced_json_no_lang(self):
        raw = '```\n[{"title":"T","body":"B","published_at":"","author":"","url":"http://x","canonical_url":""}]\n```'
        items = _parse_fallback_result(raw)
        assert len(items) == 1

    def test_empty_string_returns_empty_list(self):
        assert _parse_fallback_result("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert _parse_fallback_result("   \n  ") == []

    def test_empty_json_array_returns_empty_list(self):
        assert _parse_fallback_result("[]") == []

    def test_all_six_fields_present(self):
        raw = '[{"title":"T","body":"B","published_at":"2026","author":"A","url":"http://x","canonical_url":"http://y"}]'
        items = _parse_fallback_result(raw)
        assert set(items[0].keys()) == {"title", "body", "published_at", "author", "url", "canonical_url"}

    def test_missing_canonical_url_falls_back_to_url(self):
        raw = '[{"title":"T","body":"B","published_at":"","author":"","url":"http://x"}]'
        items = _parse_fallback_result(raw)
        assert items[0]["canonical_url"] == "http://x"

    def test_missing_fields_default_to_empty_string(self):
        raw = '[{}]'
        items = _parse_fallback_result(raw)
        assert items[0]["title"] == ""
        assert items[0]["body"] == ""
        assert items[0]["author"] == ""

    def test_multiple_items_returned(self):
        raw = '[{"title":"A","body":"X","published_at":"","author":"","url":"http://a","canonical_url":"http://a"},{"title":"B","body":"Y","published_at":"","author":"","url":"http://b","canonical_url":"http://b"}]'
        items = _parse_fallback_result(raw)
        assert len(items) == 2
        assert items[0]["title"] == "A"
        assert items[1]["title"] == "B"

    def test_prose_before_array_is_stripped(self):
        raw = 'Here are the articles I found:\n[{"title":"T","body":"B","published_at":"","author":"","url":"http://x","canonical_url":"http://x"}]'
        items = _parse_fallback_result(raw)
        assert len(items) == 1
        assert items[0]["title"] == "T"
