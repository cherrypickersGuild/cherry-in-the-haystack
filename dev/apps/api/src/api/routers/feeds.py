from fastapi import APIRouter, HTTPException

from api.deps import get_pg
from api.schemas import FeedConfigCreate, FeedConfigUpdate, FeedConfigResponse

router = APIRouter(prefix="/api/v1/feeds", tags=["feeds"])


@router.get("", response_model=list[FeedConfigResponse])
def list_feeds(enabled_only: bool = False):
    pg = get_pg()
    return pg.get_feed_configs(enabled_only=enabled_only)


@router.get("/{feed_id}", response_model=FeedConfigResponse)
def get_feed(feed_id: int):
    pg = get_pg()
    feed = pg.get_feed_config_by_id(feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    return feed


@router.post("", response_model=dict, status_code=201)
def create_feed(feed: FeedConfigCreate):
    pg = get_pg()
    new_id = pg.create_feed_config(feed.model_dump())
    return {"id": new_id, "message": "Feed created"}


@router.put("/{feed_id}", response_model=dict)
def update_feed(feed_id: int, feed: FeedConfigUpdate):
    pg = get_pg()
    updates = {k: v for k, v in feed.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    success = pg.update_feed_config(feed_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Feed not found")
    return {"message": "Feed updated"}


@router.delete("/{feed_id}", response_model=dict)
def delete_feed(feed_id: int):
    pg = get_pg()
    success = pg.delete_feed_config(feed_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feed not found")
    return {"message": "Feed deleted"}
