"""
Tests for POST /crawler/execute.

All DB calls, browser launches, and crawl4ai invocations are mocked — no real I/O.

Note on lifespan: httpx ASGITransport does NOT run the FastAPI lifespan (startup/shutdown
events). BrowserConfig is therefore set directly on app.state in the client fixture.
The lifespan itself is tested directly in TestBrowserConfigSingleton.

Test coverage:
  6.2 — Integration: success path (items returned, run_log COMPLETED)
  6.3 — Lifespan: BrowserConfig instantiated once at startup, app.state populated
  6.4 — Integration: no active crawler → 422 NO_ACTIVE_CRAWLER + run_log FAILED
  6.5 — Integration: zero items → 422 + run_log FAILED
  6.6 — Integration: timeout → 422 TIMEOUT + run_log FAILED
  6.7 — Integration: response shape verification (source_id + 6-field items)
  6.8 — Integration: run_log created with CRAWLER_EXECUTION kind on success and failure
  Unit — _parse_crawl_result() mapping and error handling
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.routers.crawler import _NoActiveCrawlerError, _parse_crawl_result

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

_SOURCE_ID = str(uuid.uuid4())
_RUN_LOG_ID = uuid.uuid4()

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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def client():
    """
    AsyncClient with mocked DB pool lifecycle.
    ASGITransport does not run the FastAPI lifespan, so app.state.browser_config
    is set directly to a MagicMock to satisfy the execute endpoint.
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
# 6.2 — Integration: success path
# ---------------------------------------------------------------------------

class TestExecuteSuccessPath:
    async def test_success_returns_source_id_and_items(self, client):
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
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")

    async def test_success_run_log_completed(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")


# ---------------------------------------------------------------------------
# 6.3 — BrowserConfig singleton (tested via lifespan directly)
# ---------------------------------------------------------------------------

class TestBrowserConfigSingleton:
    async def test_lifespan_instantiates_browser_config_once(self):
        """Verify BrowserConfig() is called exactly once during lifespan startup."""
        import os
        from api import main as _main

        mock_bc = MagicMock()
        mock_bc_class = MagicMock(return_value=mock_bc)
        fake_crawl4ai = MagicMock()
        fake_crawl4ai.BrowserConfig = mock_bc_class

        with (
            patch("api.main.init_pool", new=AsyncMock()),
            patch("api.main.close_pool", new=AsyncMock()),
            patch.dict(sys.modules, {"crawl4ai": fake_crawl4ai}),
            patch.dict(os.environ, {"DATABASE_URL": "postgresql://test/db"}),
        ):
            async with _main.lifespan(_main.app):
                pass

        mock_bc_class.assert_called_once_with(headless=True, verbose=False)

    async def test_lifespan_sets_browser_config_on_app_state(self):
        """Verify the BrowserConfig instance is stored on app.state.browser_config."""
        import os
        from api import main as _main

        mock_bc = MagicMock()
        mock_bc_class = MagicMock(return_value=mock_bc)
        fake_crawl4ai = MagicMock()
        fake_crawl4ai.BrowserConfig = mock_bc_class

        with (
            patch("api.main.init_pool", new=AsyncMock()),
            patch("api.main.close_pool", new=AsyncMock()),
            patch.dict(sys.modules, {"crawl4ai": fake_crawl4ai}),
            patch.dict(os.environ, {"DATABASE_URL": "postgresql://test/db"}),
        ):
            async with _main.lifespan(_main.app):
                assert _main.app.state.browser_config is mock_bc

    async def test_browser_config_reused_across_requests(self, client):
        """Verify the same browser_config object is passed to both execute calls."""
        captured_configs: list = []

        async def _capture_config(source_id, browser_config):
            captured_configs.append(browser_config)
            return _MAPPED_ITEMS

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute", side_effect=_capture_config),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})
            await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert len(captured_configs) == 2
        assert captured_configs[0] is captured_configs[1]


# ---------------------------------------------------------------------------
# 6.4 — No active crawler → 422 NO_ACTIVE_CRAWLER
# ---------------------------------------------------------------------------

class TestNoActiveCrawler:
    async def test_no_active_crawler_returns_422(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=_NoActiveCrawlerError("No active crawler found"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 422
        body = response.json()
        assert body["error"] == "NO_ACTIVE_CRAWLER"
        assert "detail" in body
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_no_active_crawler_run_log_failed(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=_NoActiveCrawlerError("..."))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")


# ---------------------------------------------------------------------------
# 6.5 — Zero items (full-run failure) → 422
# ---------------------------------------------------------------------------

class TestZeroItemsFailure:
    async def test_zero_items_returns_422(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=ValueError("Crawler returned zero items — full-run failure"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 422
        body = response.json()
        assert "error" in body
        assert "detail" in body
        assert "zero items" in body["detail"]
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_crawl_failure_returns_422(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=ValueError("Crawl failed: connection refused"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 422
        assert "detail" in response.json()

    async def test_no_partial_results_on_failure(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=RuntimeError("Partial extraction"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 422
        assert "items" not in response.json()


# ---------------------------------------------------------------------------
# 6.6 — Timeout → 422 TIMEOUT
# ---------------------------------------------------------------------------

class TestTimeoutPath:
    async def test_timeout_returns_422_with_timeout_error(self, client):
        async def _slow(*_args, **_kwargs):
            await asyncio.sleep(999)

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute", new=_slow),
            patch("api.routers.crawler._EXECUTE_TIMEOUT", 0.01),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 422
        body = response.json()
        assert body["error"] == "TIMEOUT"
        assert "30" in body["detail"] or "time" in body["detail"].lower()
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")


# ---------------------------------------------------------------------------
# 6.7 — Response shape verification
# ---------------------------------------------------------------------------

class TestResponseShape:
    async def test_response_has_source_id_and_items(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) >= {"source_id", "items"}

    async def test_item_has_all_six_fields(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        item = response.json()["items"][0]
        assert set(item.keys()) >= {"title", "body", "published_at", "author", "url", "canonical_url"}

    async def test_source_id_in_response_matches_request(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.json()["source_id"] == _SOURCE_ID

    async def test_error_response_has_error_and_detail_keys(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=RuntimeError("boom"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        body = response.json()
        assert set(body.keys()) >= {"error", "detail"}
        assert isinstance(body["error"], str)
        assert isinstance(body["detail"], str)


# ---------------------------------------------------------------------------
# 6.8 — run_log created with CRAWLER_EXECUTION kind
# ---------------------------------------------------------------------------

class TestRunLogKind:
    async def test_run_log_created_with_crawler_execution_kind_on_success(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)) as mock_create,
            patch("api.routers.crawler._do_execute", new=AsyncMock(return_value=_MAPPED_ITEMS)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        mock_create.assert_called_once_with(run_kind="CRAWLER_EXECUTION", status="RUNNING")

    async def test_run_log_created_with_crawler_execution_kind_on_failure(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)) as mock_create,
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=_NoActiveCrawlerError("no crawler"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        mock_create.assert_called_once_with(run_kind="CRAWLER_EXECUTION", status="RUNNING")

    async def test_run_log_written_on_general_exception(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_execute",
                  new=AsyncMock(side_effect=RuntimeError("unexpected"))),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/execute", json={"source_id": _SOURCE_ID})

        assert response.status_code == 422
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")


# ---------------------------------------------------------------------------
# Unit tests — _parse_crawl_result()
# ---------------------------------------------------------------------------

class TestParseCrawlResult:
    def test_maps_content_to_body(self):
        mock_result = MagicMock(
            success=True,
            extracted_content='[{"title":"T","content":"B","date":"2026","author":"A","url":"http://x"}]',
        )
        items = _parse_crawl_result(mock_result)
        assert len(items) == 1
        assert items[0]["body"] == "B"

    def test_maps_date_to_published_at(self):
        mock_result = MagicMock(
            success=True,
            extracted_content='[{"title":"T","content":"B","date":"2026-01-01","author":"A","url":"http://x"}]',
        )
        items = _parse_crawl_result(mock_result)
        assert items[0]["published_at"] == "2026-01-01"

    def test_url_used_as_canonical_url_fallback(self):
        mock_result = MagicMock(
            success=True,
            extracted_content='[{"title":"T","content":"B","date":"2026","author":"A","url":"http://x.com/1"}]',
        )
        items = _parse_crawl_result(mock_result)
        assert items[0]["canonical_url"] == "http://x.com/1"

    def test_returns_empty_list_when_no_extracted_content(self):
        mock_result = MagicMock(success=True, extracted_content=None)
        assert _parse_crawl_result(mock_result) == []

    def test_returns_empty_list_when_extracted_content_empty_string(self):
        mock_result = MagicMock(success=True, extracted_content="")
        assert _parse_crawl_result(mock_result) == []

    def test_raises_value_error_when_crawl_not_successful(self):
        mock_result = MagicMock(success=False, error_message="Page not found")
        with pytest.raises(ValueError, match="Crawl failed"):
            _parse_crawl_result(mock_result)

    def test_error_message_included_in_exception(self):
        mock_result = MagicMock(success=False, error_message="403 Forbidden")
        with pytest.raises(ValueError, match="403 Forbidden"):
            _parse_crawl_result(mock_result)

    def test_uses_unknown_error_when_error_message_none(self):
        mock_result = MagicMock(success=False, error_message=None)
        with pytest.raises(ValueError, match="unknown error"):
            _parse_crawl_result(mock_result)

    def test_all_six_fields_present_in_each_item(self):
        mock_result = MagicMock(
            success=True,
            extracted_content='[{"title":"T","content":"B","date":"2026","author":"A","url":"http://x"}]',
        )
        items = _parse_crawl_result(mock_result)
        assert set(items[0].keys()) == {"title", "body", "published_at", "author", "url", "canonical_url"}

    def test_missing_fields_default_to_empty_string(self):
        mock_result = MagicMock(success=True, extracted_content='[{}]')
        items = _parse_crawl_result(mock_result)
        assert items[0]["title"] == ""
        assert items[0]["body"] == ""
        assert items[0]["author"] == ""

    def test_multiple_items_returned(self):
        mock_result = MagicMock(
            success=True,
            extracted_content='[{"title":"A","content":"X","date":"2026","author":"Au","url":"http://x"},{"title":"B","content":"Y","date":"2026","author":"Au","url":"http://y"}]',
        )
        items = _parse_crawl_result(mock_result)
        assert len(items) == 2
        assert items[0]["title"] == "A"
        assert items[1]["title"] == "B"
