"""
Unit tests for pure helper functions in api.routers.crawler.

Test coverage:
  A.1 — _extract_json(): markdown-fenced JSON (with/without lang tag)
  A.2 — _extract_json(): JSON embedded in prose text
  A.3 — _extract_json(): no JSON found → JSONDecodeError
  B.1 — _load_crawl_config_from_code(): returns CRAWL_CONFIG from exec'd code
  B.2 — _load_crawl_config_from_code(): raises ValueError when CRAWL_CONFIG absent
  B.3 — _load_crawl_config_from_code(): injected symbols accessible in exec scope
"""

from __future__ import annotations

import json
import sys
from unittest.mock import MagicMock, patch

import pytest

from api.routers.crawler import _extract_json, _load_crawl_config_from_code


# ---------------------------------------------------------------------------
# A — _extract_json()
# ---------------------------------------------------------------------------

class TestExtractJson:
    def test_extracts_fenced_json_with_json_lang_tag(self):
        text = '```json\n{"key": "value"}\n```'
        assert _extract_json(text) == {"key": "value"}

    def test_extracts_fenced_json_without_lang_tag(self):
        text = '```\n{"key": "value"}\n```'
        assert _extract_json(text) == {"key": "value"}

    def test_extracts_json_embedded_in_surrounding_prose(self):
        text = 'Here is the analysis result: {"content_selector": ".posts"} as requested.'
        result = _extract_json(text)
        assert result == {"content_selector": ".posts"}

    def test_extracts_plain_json_at_root_level(self):
        result = _extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_extracts_empty_json_object(self):
        assert _extract_json("{}") == {}

    def test_extracts_nested_json_object(self):
        text = '{"outer": {"inner": true}}'
        result = _extract_json(text)
        assert result["outer"]["inner"] is True

    def test_fenced_match_takes_priority_over_bare_json_in_text(self):
        text = '```json\n{"fenced": true}\n```\n{"bare": true}'
        result = _extract_json(text)
        assert result.get("fenced") is True
        assert "bare" not in result

    def test_raises_json_decode_error_when_no_json_present(self):
        with pytest.raises(json.JSONDecodeError):
            _extract_json("no json here at all")

    def test_raises_json_decode_error_on_empty_string(self):
        with pytest.raises(json.JSONDecodeError):
            _extract_json("")

    def test_raises_json_decode_error_when_braces_contain_invalid_json(self):
        with pytest.raises(json.JSONDecodeError):
            _extract_json("{not valid json}")

    def test_multiline_fenced_json_extracted_correctly(self):
        text = '```json\n{\n  "key": "value",\n  "num": 42\n}\n```'
        result = _extract_json(text)
        assert result["key"] == "value"
        assert result["num"] == 42

    def test_leading_and_trailing_whitespace_stripped(self):
        result = _extract_json('  {"key": "val"}  ')
        assert result == {"key": "val"}


# ---------------------------------------------------------------------------
# B — _load_crawl_config_from_code()
# ---------------------------------------------------------------------------

def _make_crawl4ai_mocks():
    """Return (mock_crawl4ai, mock_extraction) with a MagicMock CrawlerRunConfig."""
    mock_config_instance = MagicMock(name="CrawlerRunConfigInstance")
    mock_crawl4ai = MagicMock(name="crawl4ai")
    mock_crawl4ai.CrawlerRunConfig = MagicMock(return_value=mock_config_instance)
    mock_extraction = MagicMock(name="crawl4ai.extraction_strategy")
    mock_extraction.JsonCssExtractionStrategy = MagicMock()
    return mock_crawl4ai, mock_extraction, mock_config_instance


class TestLoadCrawlConfigFromCode:
    def test_returns_crawl_config_object_from_generated_code(self):
        mock_crawl4ai, mock_extraction, mock_config_instance = _make_crawl4ai_mocks()

        with patch.dict(sys.modules, {
            "crawl4ai": mock_crawl4ai,
            "crawl4ai.extraction_strategy": mock_extraction,
        }):
            result = _load_crawl_config_from_code("CRAWL_CONFIG = CrawlerRunConfig()")

        assert result is mock_config_instance

    def test_raises_value_error_when_crawl_config_not_defined_in_code(self):
        mock_crawl4ai, mock_extraction, _ = _make_crawl4ai_mocks()

        with patch.dict(sys.modules, {
            "crawl4ai": mock_crawl4ai,
            "crawl4ai.extraction_strategy": mock_extraction,
        }):
            with pytest.raises(ValueError, match="CRAWL_CONFIG"):
                _load_crawl_config_from_code("x = 1  # no CRAWL_CONFIG assigned")

    def test_injected_crawler_run_config_is_callable_in_exec_scope(self):
        mock_crawl4ai, mock_extraction, _ = _make_crawl4ai_mocks()
        sentinel = object()
        mock_crawl4ai.CrawlerRunConfig.return_value = sentinel

        with patch.dict(sys.modules, {
            "crawl4ai": mock_crawl4ai,
            "crawl4ai.extraction_strategy": mock_extraction,
        }):
            result = _load_crawl_config_from_code("CRAWL_CONFIG = CrawlerRunConfig()")

        assert result is sentinel

    def test_raises_value_error_when_code_assigns_none_to_crawl_config(self):
        mock_crawl4ai, mock_extraction, _ = _make_crawl4ai_mocks()

        with patch.dict(sys.modules, {
            "crawl4ai": mock_crawl4ai,
            "crawl4ai.extraction_strategy": mock_extraction,
        }):
            with pytest.raises(ValueError, match="CRAWL_CONFIG"):
                _load_crawl_config_from_code("CRAWL_CONFIG = None")

    def test_syntax_error_in_generated_code_propagates(self):
        mock_crawl4ai, mock_extraction, _ = _make_crawl4ai_mocks()

        with patch.dict(sys.modules, {
            "crawl4ai": mock_crawl4ai,
            "crawl4ai.extraction_strategy": mock_extraction,
        }):
            with pytest.raises(SyntaxError):
                _load_crawl_config_from_code("def (: pass")
