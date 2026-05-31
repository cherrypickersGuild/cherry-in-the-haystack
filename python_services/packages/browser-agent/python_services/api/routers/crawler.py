"""
POST /crawler/analyze — browser-use page analysis endpoint.

Flow:
  1. Cache-hit:   existing crawler_analysis row → return immediately (no browser-use, no run_log).
  2. New analysis:
       a. Insert core.run_log (status=running)
       b. Invoke browser-use Agent with 60-second timeout
       c. Parse + validate analysis_json (all 11 fields via Pydantic AnalysisJson)
       d. UPSERT content.crawler_analysis
       e. UPDATE run_log (status=COMPLETED)
       f. Return { analysis_id, analysis_json }
  3. Any error:   UPDATE run_log (status=FAILED), return 422 { error, detail }
                  — no partial crawler_analysis row written on failure path.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from uuid import UUID

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ..db import client as db
from ..models.crawler import AnalysisJson, AnalyzeRequest, ExecuteRequest, FallbackRequest, GenerateRequest
from ..prompts.crawler_analysis import (
    CRAWLER_ANALYSIS_PROMPT,
    PROMPT_NAME,
    PROMPT_VERSION,
)
from ..prompts.crawler_fallback import CRAWLER_FALLBACK_PROMPT

router = APIRouter(prefix="/crawler", tags=["crawler"])

_ANALYZE_TIMEOUT: float = 300.0


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze")
async def analyze_source(req: AnalyzeRequest) -> JSONResponse:
    # AC2: cache-hit — existing record returned without browser-use or run_log write
    existing = await db.get_crawler_analysis(req.source_id)
    if existing is not None and not req.force:
        return JSONResponse(content={
            "analysis_id": str(existing["id"]),
            "analysis_json": existing["analysis_json"],
        })

    # AC1: new analysis — write run_log first, then invoke browser-use
    run_log_id = await db.create_run_log(run_kind="CRAWLER_ANALYSIS", status="RUNNING")
    try:
        analysis_json = await asyncio.wait_for(
            _run_browser_use_analysis(req.url),
            timeout=_ANALYZE_TIMEOUT,
        )
        prompt_version_id = await db.get_or_create_prompt_version(
            prompt_name=PROMPT_NAME,
            prompt_version=PROMPT_VERSION,
            prompt_content=CRAWLER_ANALYSIS_PROMPT,
        )
        analysis_id = await db.upsert_crawler_analysis(
            source_id=req.source_id,
            analysis_json=analysis_json.model_dump(),
            prompt_template_version_id=prompt_version_id,
            run_log_id=run_log_id,
            model_name=_llm_model_name(),
        )
        await db.update_run_log(run_log_id, status="SUCCESS")
        return JSONResponse(content={
            "analysis_id": str(analysis_id),
            "analysis_json": analysis_json.model_dump(),
        })

    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "TIMEOUT", "detail": f"Analysis exceeded {int(_ANALYZE_TIMEOUT)}-second time limit"},
        )
    except ValidationError as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "ANALYSIS_PARSE_FAILED", "detail": str(exc)},
        )
    except json.JSONDecodeError as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "ANALYSIS_PARSE_FAILED", "detail": f"Agent output is not valid JSON: {exc}"},
        )
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _run_browser_use_analysis(url: str) -> AnalysisJson:
    """
    Invoke browser-use Agent to analyse the page at `url`.
    Returns a validated AnalysisJson.
    """
    async def _inner() -> str | None:
        from browser_use import Agent  # deferred import — not available at module load in tests
        from browser_use.llm.anthropic.chat import ChatAnthropic
        llm = ChatAnthropic(
            model=_llm_model_name(),
            api_key=os.environ["ANTHROPIC_API_KEY"],
        )
        agent = Agent(
            task=CRAWLER_ANALYSIS_PROMPT.format(url=url),
            llm=llm,
            max_failures=10,
        )
        history = await agent.run()

        # Primary: agent explicitly called done() with the JSON result
        result = history.final_result()
        if result:
            return result

        # Fallback: scan all extracted_content entries for a JSON object
        # (agent may have produced the JSON without calling done())
        for content in reversed(history.extracted_content()):
            if content and "content_selector" in content:
                return content

        return None

    import sys
    if sys.platform == "win32":
        # uvicorn --reload uses SelectorEventLoop on Windows which doesn't support
        # asyncio.create_subprocess_exec (used by browser_use to launch Chromium).
        # Running in a thread gives browser_use its own ProactorEventLoop via asyncio.run().
        # shutdown(wait=False) prevents the executor from blocking when wait_for cancels.
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            raw_output = await asyncio.get_event_loop().run_in_executor(
                executor, lambda: asyncio.run(_inner())
            )
        finally:
            executor.shutdown(wait=False)
    else:
        raw_output = await _inner()

    if not raw_output:
        raise ValueError("Browser-use agent returned an empty result")
    analysis_dict = _extract_json(raw_output)
    return AnalysisJson(**analysis_dict)


def _extract_json(text: str) -> dict:
    """
    Extract a JSON object from agent output text.
    Handles markdown fences (```json ... ```) and leading/trailing prose.
    """
    text = text.strip()
    # Strip markdown code fences if present
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        return json.loads(fenced.group(1))
    # Fallback: find outermost { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise json.JSONDecodeError("No JSON object found in agent output", text, 0)


def _llm_model_name() -> str:
    return os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")


# ---------------------------------------------------------------------------
# POST /crawler/generate
# ---------------------------------------------------------------------------

_GENERATE_TIMEOUT: float = 30.0


@router.post("/generate")
async def generate_crawler(req: GenerateRequest) -> JSONResponse:
    run_log_id = await db.create_run_log(run_kind="CRAWLER_GENERATION", status="RUNNING")
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
        await db.update_run_log(run_log_id, status="SUCCESS")
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
    Pure template rendering — no LLM, no I/O.
    String values use json.dumps() to produce double-quoted Python strings.
    wait_for and js_code are OMITTED (not set to None) when null — per AC3.
    """
    kebab_name = _to_kebab_case(source_name)
    crawl_config_kwargs = [
        "    extraction_strategy=JsonCssExtractionStrategy(EXTRACTION_SCHEMA),",
    ]
    if analysis_json.wait_for is not None:
        crawl_config_kwargs.append(f"    wait_for={json.dumps(analysis_json.wait_for)},")
    if analysis_json.js_code is not None:
        crawl_config_kwargs.append(f"    js_code={json.dumps(analysis_json.js_code)},")
    crawl_config_kwargs.append(f"    magic={analysis_json.magic_mode},")
    crawl_config_kwargs.append('    cache_mode="bypass",')

    return (
        f"# python_services/crawlers/generated/{kebab_name}.py\n"
        "# Generated by /crawler/generate — do not edit manually.\n"
        "\n"
        "from crawl4ai.extraction_strategy import JsonCssExtractionStrategy\n"
        "from crawl4ai import CrawlerRunConfig\n"
        "\n"
        "EXTRACTION_SCHEMA = {\n"
        f'    "name": {json.dumps(source_name)},\n'
        f'    "baseSelector": {json.dumps(analysis_json.content_selector)},\n'
        '    "fields": [\n'
        f'        {{"name": "title",   "selector": {json.dumps(analysis_json.title_selector)},  "type": "text"}},\n'
        f'        {{"name": "url",     "selector": {json.dumps(analysis_json.url_selector)},    "type": "attribute", "attribute": "href"}},\n'
        f'        {{"name": "date",    "selector": {json.dumps(analysis_json.date_selector)},   "type": "attribute", "attribute": "datetime"}},\n'
        f'        {{"name": "author",  "selector": {json.dumps(analysis_json.author_selector)}, "type": "text"}},\n'
        f'        {{"name": "content", "selector": {json.dumps(analysis_json.body_selector)},   "type": "text"}},\n'
        "    ]\n"
        "}\n"
        "\n"
        "CRAWL_CONFIG = CrawlerRunConfig(\n"
        + "\n".join(crawl_config_kwargs)
        + "\n)\n"
    )


def _to_kebab_case(name: str) -> str:
    """Convert source name to kebab-case (e.g. 'Tech Crunch' → 'tech-crunch')."""
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip()).strip("-").lower()
    return slug


# ---------------------------------------------------------------------------
# POST /crawler/execute
# ---------------------------------------------------------------------------

_EXECUTE_TIMEOUT: float = 30.0


class _NoActiveCrawlerError(Exception):
    """Raised when no active crawler_registry row exists for the requested source."""


@router.post("/execute")
async def execute_crawler(req: ExecuteRequest, request: Request) -> JSONResponse:
    run_log_id = await db.create_run_log(run_kind="CRAWLER_EXECUTION", status="RUNNING")
    try:
        items = await asyncio.wait_for(
            _do_execute(req.source_id, request.app.state.browser_config),
            timeout=_EXECUTE_TIMEOUT,
        )
        await db.update_run_log(run_log_id, status="SUCCESS")
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
        raise ValueError("Crawler returned zero items — full-run failure")
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
            "body": item.get("content", ""),       # schema field "content" → body
            "published_at": item.get("date", ""),  # schema field "date" → published_at
            "author": item.get("author", ""),
            "url": item.get("url", ""),
            "canonical_url": item.get("url", ""),  # no canonical in CSS extraction; fallback
        }
        for item in raw_items
    ]


# ---------------------------------------------------------------------------
# POST /crawler/fallback
# ---------------------------------------------------------------------------

_FALLBACK_TIMEOUT: float = 60.0


@router.post("/fallback")
async def fallback_crawler(req: FallbackRequest, request: Request) -> JSONResponse:
    run_log_id = await db.create_run_log(run_kind="CRAWLER_FALLBACK", status="RUNNING")
    try:
        items = await asyncio.wait_for(
            _do_fallback(req.source_id, req.url, request.app.state.browser_config),
            timeout=_FALLBACK_TIMEOUT,
        )
        await db.update_run_log(run_log_id, status="SUCCESS")
        return JSONResponse(content={
            "source_id": str(req.source_id),
            "items": items,
        })
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": "TIMEOUT", "detail": "Fallback exceeded 60-second time limit"},
        )
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return JSONResponse(
            status_code=422,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )


async def _do_fallback(source_id: UUID, url: str, browser_config) -> list[dict]:
    """Invoke browser-use Agent to visually read the page and extract article content."""
    async def _inner() -> str | None:
        from browser_use import Agent  # deferred import — not available at module load in tests
        from browser_use.llm.anthropic.chat import ChatAnthropic
        llm = ChatAnthropic(
            model=_llm_model_name(),
            api_key=os.environ["ANTHROPIC_API_KEY"],
        )
        agent = Agent(
            task=CRAWLER_FALLBACK_PROMPT.format(url=url),
            llm=llm,
        )
        history = await agent.run()
        return history.final_result()

    import sys
    if sys.platform == "win32":
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            raw_output = await asyncio.get_event_loop().run_in_executor(
                executor, lambda: asyncio.run(_inner())
            )
        finally:
            executor.shutdown(wait=False)
    else:
        raw_output = await _inner()

    if raw_output is None:
        raw_output = ""
    return _parse_fallback_result(raw_output)


def _parse_fallback_result(raw_output: str) -> list[dict]:
    """
    Parse browser-use agent output into a list of CrawledItem dicts.
    Handles markdown fences and returns [] on empty output (not an error).
    """
    text = raw_output.strip()
    if not text:
        return []
    # Strip markdown code fences if present
    fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end > start:
            text = text[start : end + 1]
        else:
            return []
    items = json.loads(text)
    return [
        {
            "title": item.get("title", ""),
            "body": item.get("body", ""),
            "published_at": item.get("published_at", ""),
            "author": item.get("author", ""),
            "url": item.get("url", ""),
            "canonical_url": item.get("canonical_url", item.get("url", "")),
        }
        for item in items
    ]
