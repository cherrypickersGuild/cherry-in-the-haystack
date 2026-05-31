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
    date_selector: str
    author_selector: str
    url_selector: str
    body_selector: str
    # FR-2.4 required behavioral fields
    pagination_type: Literal["none", "click", "scroll"]
    dynamic_load: bool
    notes: str
    # ADR-011-R1 crawl4ai execution hints (nullable)
    wait_for: Optional[str] = None
    js_code: Optional[str] = None
    magic_mode: bool = False

    @field_validator("content_selector", "title_selector", "date_selector",
                     "author_selector", "url_selector", "body_selector", mode="before")
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
