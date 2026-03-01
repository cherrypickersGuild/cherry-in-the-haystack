from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel


# ============================================================
# Articles
# ============================================================
class ArticleBase(BaseModel):
    article_hash: str
    source: str
    list_name: str
    category: Optional[str] = None
    title: str
    url: str
    summary: Optional[str] = None
    why_it_matters: Optional[str] = None
    insights: Optional[List[str]] = None
    examples: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    tags: Optional[Any] = None
    relevant_score: Optional[float] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    notion_synced: bool = False
    notion_page_id: Optional[str] = None


class ArticleDetail(ArticleBase):
    id: int
    content: Optional[str] = None


class ArticleList(BaseModel):
    total: int
    page: int
    size: int
    items: List[ArticleBase]


class ArticleSearchResult(BaseModel):
    total: int
    page: int
    size: int
    query: str
    items: List[dict]


class ArticleStats(BaseModel):
    overview: dict
    by_source: List[dict]
    by_category: List[dict]


# ============================================================
# Feeds
# ============================================================
class FeedConfigBase(BaseModel):
    name: str
    url: str
    source_type: str = "rss"
    category: Optional[str] = None
    enabled: bool = True
    count: int = 3
    config: Optional[dict] = None


class FeedConfigCreate(FeedConfigBase):
    pass


class FeedConfigUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    source_type: Optional[str] = None
    category: Optional[str] = None
    enabled: Optional[bool] = None
    count: Optional[int] = None
    config: Optional[dict] = None


class FeedConfigResponse(FeedConfigBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# Jobs
# ============================================================
class JobRunResponse(BaseModel):
    id: int
    job_name: str
    run_id: str
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    stats: Optional[dict] = None
    error_msg: Optional[str] = None


class JobRunList(BaseModel):
    total: int
    page: int
    size: int
    items: List[JobRunResponse]


class JobTriggerResponse(BaseModel):
    success: bool
    message: str
    job_name: str


# ============================================================
# Scheduler
# ============================================================
class SchedulerJobInfo(BaseModel):
    id: str
    name: str
    next_run_time: Optional[str] = None
    trigger: str


class SchedulerStatus(BaseModel):
    running: bool
    jobs: List[SchedulerJobInfo]


# ============================================================
# Health
# ============================================================
class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    timestamp: datetime
