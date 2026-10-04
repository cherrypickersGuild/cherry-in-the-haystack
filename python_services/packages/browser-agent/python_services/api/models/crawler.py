from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


def _validate_http_url(v: str) -> str:
    if not isinstance(v, str) or not v.lower().startswith(("http://", "https://")):
        raise ValueError("url must be a valid HTTP or HTTPS URL")
    return v


class AnalyzeRequest(BaseModel):
    source_id: UUID
    url: str
    force: bool = False

    @field_validator("url", mode="before")
    @classmethod
    def _valid_url(cls, v: object) -> object:
        if isinstance(v, str):
            _validate_http_url(v)
        return v


class AnalysisJson(BaseModel):
    # FR-2.4 required selectors
    content_selector: str
    title_selector: str
    # date/author are optional in the real world — many listing pages omit them.
    # Allowed to be empty ("") so analysis of such pages doesn't fail validation.
    date_selector: str = ""
    author_selector: str = ""
    url_selector: str
    # body_selector = the body/summary text ON THE LISTING page. May be empty when the
    # full body lives on a linked detail page (see body_on_detail below).
    body_selector: str = ""
    # Two-step crawling: when the full article body is only on the linked detail page,
    # set body_on_detail=true and provide detail_body_selector (CSS for the body element
    # ON THE DETAIL PAGE). The executor then follows url_selector links to fetch the body.
    body_on_detail: bool = False
    detail_body_selector: str = ""
    # FR-2.4 required behavioral fields
    pagination_type: Literal["none", "click", "scroll"]
    dynamic_load: bool
    notes: str
    # ADR-011-R1 crawl4ai execution hints (nullable)
    wait_for: Optional[str] = None
    js_code: Optional[str] = None
    magic_mode: bool = False

    @field_validator("content_selector", "title_selector",
                     "url_selector", mode="before")
    @classmethod
    def _non_empty_selector(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            raise ValueError("selector must be a non-empty string")
        return v


class AnalyzeResponse(BaseModel):
    analysis_id: UUID
    analysis_json: AnalysisJson


class ErrorDetail(BaseModel):
    error: str
    detail: str


class GenerateRequest(BaseModel):
    source_id: UUID
    analysis_id: UUID
    source_name: str


class GenerateResponse(BaseModel):
    registry_id: UUID
    generated_code: str


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


class FallbackRequest(BaseModel):
    source_id: UUID
    url: str

    @field_validator("url", mode="before")
    @classmethod
    def _valid_url(cls, v: object) -> object:
        if isinstance(v, str):
            _validate_http_url(v)
        return v


class FallbackResponse(BaseModel):
    source_id: UUID
    items: list[CrawledItem]
