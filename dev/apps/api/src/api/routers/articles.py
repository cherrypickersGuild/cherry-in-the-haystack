from typing import Optional

from fastapi import APIRouter, Query

from api.deps import get_pg
from api.schemas import ArticleList, ArticleDetail, ArticleSearchResult, ArticleStats

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])


@router.get("", response_model=ArticleList)
def list_articles(
    source: Optional[str] = Query(None, description="Filter by source (RSS, HackerNews, Dev.to, Substack)"),
    category: Optional[str] = Query(None, description="Filter by category (practical, business, big_tech, insights)"),
    from_date: Optional[str] = Query(None, alias="from", description="Filter from date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, alias="to", description="Filter to date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("published_at", description="Sort field"),
    order: str = Query("desc", description="Sort order (asc/desc)"),
):
    pg = get_pg()
    return pg.get_articles(
        source=source,
        category=category,
        from_date=from_date,
        to_date=to_date,
        page=page,
        size=size,
        sort_by=sort_by,
        order=order,
    )


@router.get("/search", response_model=ArticleSearchResult)
def search_articles(
    q: str = Query(..., min_length=2, description="Search query"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    pg = get_pg()
    return pg.search_articles(query=q, page=page, size=size)


@router.get("/stats", response_model=ArticleStats)
def article_stats():
    pg = get_pg()
    return pg.get_article_stats()


@router.get("/{article_hash}")
def get_article(article_hash: str):
    pg = get_pg()
    article = pg.get_article_by_hash(article_hash)
    if not article:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Article not found")
    return article
