"""
Tests for POST /crawler/generate.

All DB calls are mocked — no real I/O.

Test coverage:
  4.1 — Unit tests for _generate_crawler_script()
  4.2 — Integration: success path (DB mocked, run_log writes, registry INSERT, response shape)
  4.3 — Integration: error path (DB fetch raises → 422 + run_log FAILED, no registry row)
  4.4 — Integration: timeout → 422 TIMEOUT + run_log FAILED
  4.5 — Unit test: generated script has no hardcoded credentials
"""

from __future__ import annotations

import asyncio
import re
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.models.crawler import AnalysisJson
from api.routers.crawler import _generate_crawler_script, _to_kebab_case

# ---------------------------------------------------------------------------
# Shared fixtures / constants
# ---------------------------------------------------------------------------

_SOURCE_ID = str(uuid.uuid4())
_ANALYSIS_ID = uuid.uuid4()
_REGISTRY_ID = uuid.uuid4()
_RUN_LOG_ID = uuid.uuid4()

_VALID_ANALYSIS = AnalysisJson(
    content_selector=".post-list .post",
    title_selector=".post-title a",
    date_selector=".post-date",
    author_selector=".post-author",
    url_selector=".post-title a",
    body_selector=".post-body",
    pagination_type="none",
    dynamic_load=False,
    notes="Standard blog feed",
    wait_for=None,
    js_code=None,
    magic_mode=False,
)

_VALID_ANALYSIS_DICT = _VALID_ANALYSIS.model_dump()


@pytest.fixture
async def client():
    """AsyncClient with mocked DB pool lifecycle — no real database needed."""
    with (
        patch("api.db.client.init_pool", new=AsyncMock()),
        patch("api.db.client.close_pool", new=AsyncMock()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac


# ---------------------------------------------------------------------------
# 4.1 — Unit tests: _generate_crawler_script()
# ---------------------------------------------------------------------------

class TestGenerateCrawlerScript:
    def test_extraction_schema_has_all_five_fields(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        for field in ("title", "url", "date", "author", "content"):
            assert f'"name": "{field}"' in script

    def test_base_selector_in_extraction_schema(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert '"baseSelector": ".post-list .post"' in script

    def test_crawl_config_exported(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "CRAWL_CONFIG = CrawlerRunConfig(" in script

    def test_extraction_schema_exported(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "EXTRACTION_SCHEMA = {" in script

    def test_wait_for_omitted_when_null(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "wait_for" not in script

    def test_js_code_omitted_when_null(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "js_code" not in script

    def test_wait_for_included_when_set(self):
        analysis = _VALID_ANALYSIS.model_copy(update={"wait_for": "css:.article-list"})
        script = _generate_crawler_script(analysis, "Test Source")
        assert "wait_for" in script
        assert "css:.article-list" in script

    def test_js_code_included_when_set(self):
        analysis = _VALID_ANALYSIS.model_copy(
            update={"js_code": "window.scrollTo(0, document.body.scrollHeight)"}
        )
        script = _generate_crawler_script(analysis, "Test Source")
        assert "js_code" in script
        assert "window.scrollTo" in script

    def test_magic_false_in_crawl_config(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "magic=False" in script

    def test_magic_true_in_crawl_config(self):
        analysis = _VALID_ANALYSIS.model_copy(update={"magic_mode": True})
        script = _generate_crawler_script(analysis, "Test Source")
        assert "magic=True" in script

    def test_cache_mode_bypass_always_present(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert 'cache_mode="bypass"' in script

    def test_source_name_in_extraction_schema(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "My Blog")
        assert "'My Blog'" in script or '"My Blog"' in script

    def test_correct_imports_in_generated_script(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "from crawl4ai.extraction_strategy import JsonCssExtractionStrategy" in script
        assert "from crawl4ai import CrawlerRunConfig" in script

    def test_kebab_filename_in_header_comment(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Tech Crunch")
        assert "tech-crunch.py" in script

    def test_do_not_edit_comment_present(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "do not edit manually" in script

    def test_content_field_uses_body_selector_not_content_selector(self):
        analysis = _VALID_ANALYSIS.model_copy(update={
            "content_selector": ".post-list .post",
            "body_selector": ".post-body",
        })
        script = _generate_crawler_script(analysis, "Test Source")
        # The content field must reference body_selector, not content_selector
        assert '"name": "content"' in script
        assert '".post-body"' in script
        # Verify content_selector only appears as baseSelector, not as a field selector
        lines = script.splitlines()
        content_field_line = next(l for l in lines if '"name": "content"' in l)
        assert '".post-list .post"' not in content_field_line


# ---------------------------------------------------------------------------
# 4.5 — Unit test: no hardcoded credentials
# ---------------------------------------------------------------------------

class TestNoHardcodedCredentials:
    def test_no_api_key_patterns(self):
        analysis = _VALID_ANALYSIS.model_copy(update={"magic_mode": True, "wait_for": "css:.x"})
        script = _generate_crawler_script(analysis, "Secure Source")
        assert not re.search(r"(sk-|eyJ|password\s*=\s*['\"])", script)

    def test_no_token_patterns(self):
        script = _generate_crawler_script(_VALID_ANALYSIS, "Test Source")
        assert "Bearer " not in script
        assert "Authorization:" not in script


# ---------------------------------------------------------------------------
# Helper: _to_kebab_case
# ---------------------------------------------------------------------------

class TestToKebabCase:
    def test_spaces_become_hyphens(self):
        assert _to_kebab_case("Tech Crunch") == "tech-crunch"

    def test_special_chars_become_hyphens(self):
        assert _to_kebab_case("foo.bar_baz") == "foo-bar-baz"

    def test_leading_trailing_stripped(self):
        assert _to_kebab_case("  hello  ") == "hello"

    def test_all_lowercase(self):
        assert _to_kebab_case("LinkedIn") == "linkedin"

    def test_consecutive_special_chars_single_hyphen(self):
        assert _to_kebab_case("hello & world") == "hello-world"


# ---------------------------------------------------------------------------
# 4.2 — Integration: success path
# ---------------------------------------------------------------------------

class TestGenerateSuccessPath:
    async def test_success_returns_registry_id_and_generated_code(self, client):
        fake_script = "# generated script\nEXTRACTION_SCHEMA = {}\nCRAWL_CONFIG = CrawlerRunConfig()\n"
        analysis_row = {"id": _ANALYSIS_ID, "analysis_json": _VALID_ANALYSIS_DICT}

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler.db.get_crawler_analysis_by_id", new=AsyncMock(return_value=analysis_row)),
            patch("api.routers.crawler._generate_crawler_script", return_value=fake_script),
            patch("api.routers.crawler.db.insert_crawler_registry", new=AsyncMock(return_value=_REGISTRY_ID)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        assert response.status_code == 200
        body = response.json()
        assert body["registry_id"] == str(_REGISTRY_ID)
        assert body["generated_code"] == fake_script
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="SUCCESS")

    async def test_run_log_created_with_crawler_generation_kind(self, client):
        fake_script = "# script\n"
        analysis_row = {"id": _ANALYSIS_ID, "analysis_json": _VALID_ANALYSIS_DICT}

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)) as mock_create,
            patch("api.routers.crawler.db.get_crawler_analysis_by_id", new=AsyncMock(return_value=analysis_row)),
            patch("api.routers.crawler._generate_crawler_script", return_value=fake_script),
            patch("api.routers.crawler.db.insert_crawler_registry", new=AsyncMock(return_value=_REGISTRY_ID)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        mock_create.assert_called_once_with(run_kind="CRAWLER_GENERATION", status="RUNNING")

    async def test_registry_insert_called_with_correct_args(self, client):
        fake_script = "# script\n"
        analysis_row = {"id": _ANALYSIS_ID, "analysis_json": _VALID_ANALYSIS_DICT}
        source_uuid = uuid.UUID(_SOURCE_ID)

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler.db.get_crawler_analysis_by_id", new=AsyncMock(return_value=analysis_row)),
            patch("api.routers.crawler._generate_crawler_script", return_value=fake_script),
            patch("api.routers.crawler.db.insert_crawler_registry", new=AsyncMock(return_value=_REGISTRY_ID)) as mock_insert,
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        kwargs = mock_insert.call_args.kwargs
        assert kwargs["source_id"] == source_uuid
        assert kwargs["analysis_id"] == _ANALYSIS_ID
        assert kwargs["generated_code"] == fake_script
        assert kwargs["run_log_id"] == _RUN_LOG_ID


# ---------------------------------------------------------------------------
# 4.3 — Integration: error path
# ---------------------------------------------------------------------------

class TestGenerateErrorPath:
    async def test_db_fetch_none_returns_422(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler.db.get_crawler_analysis_by_id", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.insert_crawler_registry", new=AsyncMock()) as mock_insert,
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        assert response.status_code == 422
        body = response.json()
        assert "error" in body
        assert "detail" in body
        # AC4: no registry row written on failure
        mock_insert.assert_not_called()
        # AC4: run_log marked FAILED
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_exception_in_generate_returns_422(self, client):
        analysis_row = {"id": _ANALYSIS_ID, "analysis_json": _VALID_ANALYSIS_DICT}

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler.db.get_crawler_analysis_by_id", new=AsyncMock(return_value=analysis_row)),
            patch("api.routers.crawler._generate_crawler_script",
                  side_effect=RuntimeError("Template render failed")),
            patch("api.routers.crawler.db.insert_crawler_registry", new=AsyncMock()) as mock_insert,
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        assert response.status_code == 422
        body = response.json()
        assert "Template render failed" in body["detail"]
        mock_insert.assert_not_called()
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")

    async def test_error_response_has_correct_shape(self, client):
        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler.db.get_crawler_analysis_by_id", new=AsyncMock(return_value=None)),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()),
        ):
            response = await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        body = response.json()
        assert set(body.keys()) >= {"error", "detail"}
        assert isinstance(body["error"], str)
        assert isinstance(body["detail"], str)


# ---------------------------------------------------------------------------
# 4.4 — Integration: timeout
# ---------------------------------------------------------------------------

class TestGenerateTimeoutPath:
    async def test_timeout_returns_422_with_timeout_error(self, client):
        async def _slow(*_args, **_kwargs):
            await asyncio.sleep(999)

        with (
            patch("api.routers.crawler.db.create_run_log", new=AsyncMock(return_value=_RUN_LOG_ID)),
            patch("api.routers.crawler._do_generate", new=_slow),
            patch("api.routers.crawler._GENERATE_TIMEOUT", 0.01),
            patch("api.routers.crawler.db.update_run_log", new=AsyncMock()) as mock_update,
        ):
            response = await client.post("/crawler/generate", json={
                "source_id": _SOURCE_ID,
                "analysis_id": str(_ANALYSIS_ID),
                "source_name": "Test Source",
            })

        assert response.status_code == 422
        body = response.json()
        assert body["error"] == "TIMEOUT"
        assert "30" in body["detail"] or "time" in body["detail"].lower()
        mock_update.assert_called_once_with(_RUN_LOG_ID, status="FAILED")
