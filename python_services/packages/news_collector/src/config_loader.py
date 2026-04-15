"""
Config loader for news_collector - reads source configuration from PostgreSQL.

This module provides a bridge between the content.source table in PostgreSQL
and the news_collector operators (ops_rss, ops_twitter, etc.).

The flow is:
  Notion Sources DB --> sync_sources.py --> PostgreSQL content.source --> config_loader.py --> ops_*.py
"""

import os
from typing import TypedDict, Optional, List
from dataclasses import dataclass
from enum import Enum

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()


class SourceType(str, Enum):
    """Source type enum matching PostgreSQL source_type_enum"""
    RSS = "RSS"
    TWITTER = "TWITTER"
    YOUTUBE = "YOUTUBE"
    REDDIT = "REDDIT"
    BLOG = "BLOG"


@dataclass
class SourceConfig:
    """
    Configuration for a content source.

    Maps to content.source table in PostgreSQL.
    """
    id: str  # UUID as string
    type: SourceType
    name: str
    url_handle: str
    is_active: bool = True
    count: int = 3  # Number of items to fetch per run
    external_source_id: Optional[str] = None  # Notion page ID
    homepage_url: Optional[str] = None
    description: Optional[str] = None
    frequency: str = "DAILY"
    language: Optional[str] = None
    country_code: Optional[str] = None
    source_meta_json: Optional[dict] = None


class RSSFeed(TypedDict):
    """RSS feed configuration compatible with ops_rss.py"""
    name: str
    url: str
    enabled: bool
    count: int


class TwitterHandle(TypedDict):
    """Twitter handle configuration compatible with ops_twitter.py"""
    twitter_id: str
    name: str
    list_name: str


class RedditSub(TypedDict):
    """Reddit subreddit configuration compatible with ops_reddit.py"""
    subreddit: str
    list_name: str


def get_database_url() -> str:
    """Get database URL from environment."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url
    # Default for local development
    return "postgresql://cherry:cherry_dev@localhost:5432/cherry_db"


def create_db_engine(echo: bool = False):
    """Create SQLAlchemy engine for PostgreSQL."""
    url = get_database_url()
    return create_engine(
        url,
        echo=echo,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )


def get_session_maker(engine=None) -> sessionmaker:
    """Get session maker for database operations."""
    if engine is None:
        engine = create_db_engine()
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def load_active_sources() -> List[SourceConfig]:
    """
    Load all active sources from PostgreSQL content.source table.

    Returns:
        List of SourceConfig objects for active sources.
    """
    engine = create_db_engine()
    sources = []

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                id, type, name, url_handle, is_active,
                external_source_id, homepage_url, description,
                frequency, language, country_code, source_meta_json
            FROM content.source
            WHERE is_active = TRUE AND revoked_at IS NULL
            ORDER BY name
        """))

        for row in result:
            # Parse source_meta_json for count if available
            count = 3  # default
            source_meta = row.source_meta_json
            if source_meta and isinstance(source_meta, dict):
                count = source_meta.get("count", 3)

            sources.append(SourceConfig(
                id=str(row.id),
                type=SourceType(row.type),
                name=row.name,
                url_handle=row.url_handle,
                is_active=row.is_active,
                count=count,
                external_source_id=row.external_source_id,
                homepage_url=row.homepage_url,
                description=row.description,
                frequency=row.frequency or "DAILY",
                language=row.language,
                country_code=row.country_code,
                source_meta_json=source_meta,
            ))

    print(f"[config_loader] Loaded {len(sources)} active sources from PostgreSQL")
    return sources


def load_rss_feeds() -> List[RSSFeed]:
    """
    Load RSS feeds from PostgreSQL in format compatible with ops_rss.py.

    This function provides backward compatibility with the existing
    config.rss_feeds.get_enabled_feeds() pattern.

    Returns:
        List of RSSFeed TypedDict compatible with ops_rss.py
    """
    sources = load_active_sources()
    feeds = []

    for source in sources:
        if source.type == SourceType.RSS:
            feeds.append(RSSFeed(
                name=source.name,
                url=source.url_handle,
                enabled=source.is_active,
                count=source.count,
            ))

    print(f"[config_loader] Loaded {len(feeds)} RSS feeds from PostgreSQL")
    return feeds


def load_twitter_handles() -> dict[str, List[TwitterHandle]]:
    """
    Load Twitter handles from PostgreSQL in format compatible with ops_twitter.py.

    Returns:
        Dict mapping list_name to list of TwitterHandle configs.
    """
    sources = load_active_sources()
    handles_by_list: dict[str, List[TwitterHandle]] = {}

    for source in sources:
        if source.type == SourceType.TWITTER:
            # Use frequency as list_name (e.g., "AI", "Tech") or default to "default"
            list_name = source.frequency or "default"

            if list_name not in handles_by_list:
                handles_by_list[list_name] = []

            # Extract twitter_id from url_handle (e.g., "@username" or "username")
            twitter_id = source.url_handle.lstrip("@")

            handles_by_list[list_name].append(TwitterHandle(
                twitter_id=twitter_id,
                name=source.name,
                list_name=list_name,
            ))

    print(f"[config_loader] Loaded {sum(len(v) for v in handles_by_list.values())} Twitter handles from PostgreSQL")
    return handles_by_list


def load_reddit_subs() -> dict[str, List[RedditSub]]:
    """
    Load Reddit subreddits from PostgreSQL in format compatible with ops_reddit.py.

    Returns:
        Dict mapping list_name to list of RedditSub configs.
    """
    sources = load_active_sources()
    subs_by_list: dict[str, List[RedditSub]] = {}

    for source in sources:
        if source.type == SourceType.REDDIT:
            list_name = source.frequency or "default"

            if list_name not in subs_by_list:
                subs_by_list[list_name] = []

            # Extract subreddit name from url_handle
            subreddit = source.url_handle
            if subreddit.startswith("r/"):
                subreddit = subreddit[2:]

            subs_by_list[list_name].append(RedditSub(
                subreddit=subreddit,
                list_name=list_name,
            ))

    print(f"[config_loader] Loaded {sum(len(v) for v in subs_by_list.values())} Reddit subs from PostgreSQL")
    return subs_by_list


# Backward compatibility functions
def get_enabled_feeds() -> List[RSSFeed]:
    """
    Get enabled RSS feeds - backward compatible with config.rss_feeds.get_enabled_feeds().

    This function first tries to load from PostgreSQL. If no sources are found
    or database is unavailable, it falls back to the legacy config.

    Returns:
        List of RSSFeed TypedDict
    """
    try:
        feeds = load_rss_feeds()
        if feeds:
            return feeds
    except Exception as e:
        print(f"[config_loader] Warning: Failed to load from PostgreSQL: {e}")

    # Fallback to legacy config
    print("[config_loader] Falling back to legacy config.rss_feeds")
    from config.rss_feeds import get_enabled_feeds as legacy_get_enabled_feeds
    return legacy_get_enabled_feeds()


if __name__ == "__main__":
    # Test the config loader
    print("Testing config_loader...")

    print("\n=== Active Sources ===")
    sources = load_active_sources()
    for s in sources:
        print(f"  - [{s.type}] {s.name}: {s.url_handle}")

    print("\n=== RSS Feeds ===")
    feeds = load_rss_feeds()
    for f in feeds:
        print(f"  - {f['name']}: {f['url']} (count={f['count']})")

    print("\n=== Twitter Handles ===")
    handles = load_twitter_handles()
    for list_name, h_list in handles.items():
        print(f"  - {list_name}:")
        for h in h_list:
            print(f"      @{h['twitter_id']} ({h['name']})")

    print("\n=== Reddit Subs ===")
    subs = load_reddit_subs()
    for list_name, s_list in subs.items():
        print(f"  - {list_name}:")
        for s in s_list:
            print(f"      r/{s['subreddit']}")
