"""
POST /crawler/run-all — one-shot onboarding test endpoint (A-1).

A single call chains the three onboarding steps in order:

    1. analyze   — browser-use analyses the page, result persisted to crawler_analysis
    2. generate  — render the crawl4ai script, persisted to crawler_registry (pending_review)
    3. execute   — run the freshly generated crawler IMMEDIATELY (PR-merge gate bypassed),
                   returning the collected articles

Design notes:
  - Each step is guarded. On any failure the call stops and returns
    422 { step, error, detail } so the caller knows exactly where it broke.
  - analyze/generate write to the DB the same way the standalone endpoints do.
  - The final result (including collected items) is also saved to a JSON file
    under ./output/ for inspection. Articles are NOT written to content.article_raw
    (that is A-2 / the Node pipeline's job).
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from ..db import client as db
from ..prompts.crawler_analysis import (
    CRAWLER_ANALYSIS_PROMPT,
    PROMPT_NAME,
    PROMPT_VERSION,
)
from . import crawler  # reuse the existing step helpers

router = APIRouter(prefix="/crawler", tags=["crawler"])

_ANALYZE_TIMEOUT: float = 300.0
_GENERATE_TIMEOUT: float = 30.0
# Two-step crawling (listing + per-article detail pages) needs a longer budget.
_EXECUTE_TIMEOUT: float = 180.0
# Cap how many detail pages we visit per run (each is a separate page fetch).
_MAX_DETAIL_PAGES: int = 10

# Where final run-all results are dumped as JSON.
_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"


class RunAllRequest(BaseModel):
    source_id: UUID
    url: str
    source_name: Optional[str] = None
    force: bool = False  # re-run analyze even if a cached analysis exists

    @field_validator("url", mode="before")
    @classmethod
    def _valid_url(cls, v: object) -> object:
        if isinstance(v, str) and not v.lower().startswith(("http://", "https://")):
            raise ValueError("url must be a valid HTTP or HTTPS URL")
        return v


def _step_error(step: str, error: str, detail: str) -> JSONResponse:
    """Uniform error envelope identifying which step failed."""
    return JSONResponse(
        status_code=422,
        content={"ok": False, "step": step, "error": error, "detail": detail},
    )


def _save_result(payload: dict) -> str:
    """Dump the full run-all result to ./output/run-all-<source>-<ts>.json."""
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = _OUTPUT_DIR / f"run-all-{payload['source_id']}-{ts}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path)


@router.post("/run-all")
async def run_all(req: RunAllRequest, request: Request) -> JSONResponse:
    # --- Step 0: validate the source exists (friendly error before any AI cost) ---
    source = await db.get_source(req.source_id)
    if source is None:
        return _step_error(
            "validate",
            "SOURCE_NOT_FOUND",
            f"source_id={req.source_id} 가 content.source 에 없습니다. 먼저 소스를 등록하세요.",
        )

    source_name = req.source_name or urlparse(req.url).netloc or "unknown-source"
    steps: dict = {}

    # ----------------------------------------------------------------- Step 1: analyze
    cached = await db.get_crawler_analysis(req.source_id)
    if cached is not None and not req.force:
        analysis_id = cached["id"]
        analysis_dict = cached["analysis_json"]
        steps["analyze"] = {"ok": True, "cached": True, "analysis_id": str(analysis_id)}
    else:
        run_log_id = await db.create_run_log(run_kind="CRAWLER_ANALYSIS", status="RUNNING")
        try:
            analysis_json = await asyncio.wait_for(
                crawler._run_browser_use_analysis(req.url),
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
                model_name=crawler._llm_model_name(),
            )
            await db.update_run_log(run_log_id, status="SUCCESS")
            analysis_dict = analysis_json.model_dump()
            steps["analyze"] = {"ok": True, "cached": False, "analysis_id": str(analysis_id)}
        except asyncio.TimeoutError:
            await db.update_run_log(run_log_id, status="FAILED")
            return _step_error("analyze", "TIMEOUT", f"분석이 {int(_ANALYZE_TIMEOUT)}초 제한을 초과했습니다.")
        except Exception as exc:
            await db.update_run_log(run_log_id, status="FAILED")
            return _step_error("analyze", type(exc).__name__, str(exc))

    # ---------------------------------------------------------------- Step 2: generate
    run_log_id = await db.create_run_log(run_kind="CRAWLER_GENERATION", status="RUNNING")
    try:
        generated_code = await asyncio.wait_for(
            crawler._do_generate(analysis_id, source_name),
            timeout=_GENERATE_TIMEOUT,
        )
        registry_id = await db.insert_crawler_registry(
            source_id=req.source_id,
            analysis_id=analysis_id,
            generated_code=generated_code,
            run_log_id=run_log_id,
        )
        await db.update_run_log(run_log_id, status="SUCCESS")
        steps["generate"] = {"ok": True, "registry_id": str(registry_id)}
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return _step_error("generate", "TIMEOUT", "코드 생성이 30초 제한을 초과했습니다.")
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return _step_error("generate", type(exc).__name__, str(exc))

    # ----------------------------------------------------------------- Step 3: execute
    # PR-merge gate bypassed: run the just-generated code directly against req.url.
    run_log_id = await db.create_run_log(run_kind="CRAWLER_EXECUTION", status="RUNNING")
    try:
        items = await asyncio.wait_for(
            _execute_two_step(analysis_dict, req.url, request.app.state.browser_config),
            timeout=_EXECUTE_TIMEOUT,
        )
        await db.update_run_log(run_log_id, status="SUCCESS")
        steps["execute"] = {
            "ok": True,
            "item_count": len(items),
            "body_on_detail": bool(analysis_dict.get("body_on_detail")),
        }
    except asyncio.TimeoutError:
        await db.update_run_log(run_log_id, status="FAILED")
        return _step_error("execute", "TIMEOUT", "크롤러 실행이 30초 제한을 초과했습니다.")
    except Exception as exc:
        await db.update_run_log(run_log_id, status="FAILED")
        return _step_error("execute", type(exc).__name__, str(exc))

    # ------------------------------------------------------------------- save + return
    payload = {
        "ok": True,
        "source_id": str(req.source_id),
        "url": req.url,
        "source_name": source_name,
        "steps": steps,
        "analysis_json": analysis_dict,
        "items": items,
    }
    payload["saved_to"] = _save_result(payload)
    return JSONResponse(content=payload)


def _main_content(crawl_result) -> str:
    """
    Best-effort main-article text from a crawl4ai result.
    Prefers fit_markdown (readability-filtered) → raw_markdown → cleaned_html text.
    """
    md = getattr(crawl_result, "markdown", None)
    if md is not None:
        for attr in ("fit_markdown", "raw_markdown"):
            val = getattr(md, attr, None)
            if val:
                return val.strip()
        if isinstance(md, str) and md.strip():
            return md.strip()
    cleaned = getattr(crawl_result, "cleaned_html", None)
    if cleaned:
        from bs4 import BeautifulSoup
        return BeautifulSoup(cleaned, "html.parser").get_text(" ", strip=True)
    return ""


async def _execute_two_step(analysis: dict, listing_url: str, browser_config) -> list[dict]:
    """
    Two-step crawl driven by the analysis selectors:
      1. Fetch the listing page, extract one record per content_selector element
         (title, link, date, author, listing summary).
      2. If body_on_detail is set, follow each article link and extract the full body
         from the detail page via detail_body_selector. Otherwise use the listing summary.

    Uses BeautifulSoup on crawl4ai's rendered HTML so we control link/href extraction
    exactly (handles the "item element IS the <a>" case that JsonCssExtractionStrategy
    cannot express).
    """
    from urllib.parse import urljoin

    from bs4 import BeautifulSoup
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
    from crawl4ai.content_filter_strategy import PruningContentFilter
    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

    content_sel = analysis["content_selector"]
    title_sel = analysis.get("title_selector") or ""
    url_sel = analysis.get("url_selector") or ""
    date_sel = analysis.get("date_selector") or ""
    author_sel = analysis.get("author_selector") or ""
    body_sel = analysis.get("body_selector") or ""
    body_on_detail = bool(analysis.get("body_on_detail"))
    detail_body_sel = analysis.get("detail_body_selector") or ""
    wait_for = analysis.get("wait_for") or None

    def _text(node, sel: str) -> str:
        if not sel or node is None:
            return ""
        el = node.select_one(sel)
        return el.get_text(" ", strip=True) if el else ""

    def _href(card) -> str:
        # If the repeating element itself is the link, read its href directly.
        if card.name == "a" and card.get("href"):
            return card["href"]
        if url_sel:
            a = card.select_one(url_sel)
            if a is not None and a.get("href"):
                return a["href"]
        # Fallback: first descendant anchor with an href.
        a = card.find("a", href=True)
        return a["href"] if a else ""

    listing_cfg = CrawlerRunConfig(cache_mode="bypass", wait_for=wait_for)
    # Detail pages: strip site chrome and run readability pruning so fit_markdown is clean.
    detail_cfg = CrawlerRunConfig(
        cache_mode="bypass",
        excluded_tags=["nav", "footer", "header", "form", "aside"],
        exclude_external_links=True,
        word_count_threshold=10,
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(threshold=0.48, threshold_type="fixed"),
        ),
    )

    async with AsyncWebCrawler(config=browser_config) as ac:
        res = await ac.arun(url=listing_url, config=listing_cfg)
        if not res.success:
            raise ValueError(f"목록 페이지 크롤 실패: {res.error_message or 'unknown error'}")

        soup = BeautifulSoup(res.html, "html.parser")
        cards = soup.select(content_sel)
        items: list[dict] = []
        for card in cards:
            href = _href(card)
            items.append({
                "title": _text(card, title_sel),
                "summary": _text(card, body_sel),
                "published_at": _text(card, date_sel),
                "author": _text(card, author_sel),
                "url": urljoin(listing_url, href) if href else "",
            })

        if not items:
            raise ValueError(
                f"content_selector '{content_sel}' 로 0개 항목 — 셀렉터가 페이지와 안 맞습니다."
            )

        # Step 2: follow links for the real body when it lives on the detail page.
        # Prefer detail_body_selector if the analysis provided one; otherwise fall back to
        # crawl4ai's built-in main-content (readability) extraction — robust for any article.
        if body_on_detail:
            for it in items[:_MAX_DETAIL_PAGES]:
                if not it["url"]:
                    it["body"] = ""
                    continue
                d = await ac.arun(url=it["url"], config=detail_cfg)
                if not d.success:
                    it["body"] = ""
                    continue
                dsoup = BeautifulSoup(d.html, "html.parser")
                # The detail page <h1> is the full article title — more reliable than the
                # listing card's <h2> (which is often just the company/short name).
                h1 = dsoup.select_one("h1")
                if h1 and h1.get_text(strip=True):
                    it["title"] = h1.get_text(" ", strip=True)
                body = _text(dsoup, detail_body_sel) if detail_body_sel else ""
                if not body:
                    body = _main_content(d)
                it["body"] = body
            for it in items[_MAX_DETAIL_PAGES:]:
                it["body"] = it.get("summary", "")
        else:
            for it in items:
                it["body"] = it.get("summary", "")

    return [
        {
            "title": it["title"],
            "body": it.get("body", ""),
            "published_at": it["published_at"],
            "author": it["author"],
            "url": it["url"],
            "canonical_url": it["url"],
        }
        for it in items
    ]
