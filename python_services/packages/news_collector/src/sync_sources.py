"""
Notion → PostgreSQL source sync service.

Syncs content sources from Notion "Sources" database to PostgreSQL content.source table.
This allows users to manage sources in Notion while news_collector reads from PostgreSQL.

Usage:
    python -m news_collector.sync_sources
    python -m news_collector.sync_sources --dry-run
"""

import os
import re
import argparse
import hashlib
import traceback
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from notion import NotionAgent

load_dotenv()


# Source type mapping from Notion to PostgreSQL
NOTION_TYPE_TO_PG = {
    "RSS": "RSS",
    "Twitter": "TWITTER",
    "X": "TWITTER",
    "YouTube": "YOUTUBE",
    "Youtube": "YOUTUBE",
    "Reddit": "REDDIT",
    "Blog": "BLOG",
    "Web": "BLOG",
    "Newsletter": "RSS",  # Newsletters often have RSS feeds
}


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


def detect_source_type(url: str) -> str:
    """
    Detect source type from URL pattern.

    Args:
        url: The source URL

    Returns:
        Source type string (RSS, TWITTER, YOUTUBE, REDDIT, or BLOG)
    """
    url_lower = url.lower()

    if "twitter.com/" in url_lower or "x.com/" in url_lower:
        return "TWITTER"
    elif "youtube.com/" in url_lower or "youtu.be/" in url_lower:
        return "YOUTUBE"
    elif "reddit.com/r/" in url_lower:
        return "REDDIT"
    elif any(pattern in url_lower for pattern in ["/rss", "/feed", "/atom", "rss.xml", "feed.xml"]):
        return "RSS"
    else:
        # Default to RSS for feed-like URLs, BLOG for others
        return "RSS"


def map_notion_type(notion_type: Optional[str], url: str) -> str:
    """
    Map Notion source type to PostgreSQL source_type_enum.

    Args:
        notion_type: The type from Notion select field
        url: The source URL (for type detection if needed)

    Returns:
        PostgreSQL source type string
    """
    if notion_type:
        pg_type = NOTION_TYPE_TO_PG.get(notion_type)
        if pg_type:
            return pg_type

    # Fall back to URL detection
    return detect_source_type(url)


def compute_url_hash(url: str) -> bytes:
    """Compute MD5 hash of URL for deduplication."""
    return hashlib.md5(url.encode('utf-8')).digest()


def fetch_notion_sources(notion_agent: NotionAgent, database_id: str) -> list[dict]:
    """
    Fetch sources from Notion Sources database.

    Args:
        notion_agent: NotionAgent instance
        database_id: The Notion database ID for sources

    Returns:
        List of source dictionaries
    """
    print(f"[sync_sources] Fetching sources from Notion database: {database_id}")

    query_data = {
        "database_id": database_id,
        "sorts": [
            {
                "property": "Created time",
                "direction": "descending",
            },
        ],
        "filter": {}  # Get all, we'll filter by is_active later
    }

    response = notion_agent.api.databases.query(**query_data)
    pages = response.get("results", [])

    sources = []
    for page in pages:
        try:
            props = page["properties"]

            # Extract name (title field)
            name = ""
            title_prop = props.get("Name") or props.get("name") or {}
            if title_prop.get("title"):
                name = title_prop["title"][0]["text"]["content"]

            # Extract URL
            url = ""
            url_prop = props.get("URL") or props.get("url") or {}
            if url_prop.get("url"):
                url = url_prop["url"]

            if not url:
                print(f"[sync_sources] Skipping source without URL: {name}")
                continue

            # Extract type (select field)
            notion_type = None
            type_prop = props.get("Type") or props.get("type") or {}
            if type_prop.get("select"):
                notion_type = type_prop["select"]["name"]

            # Extract is_active (checkbox)
            is_active = True
            active_prop = props.get("Active") or props.get("Enabled") or props.get("active") or props.get("enabled") or {}
            if "checkbox" in active_prop:
                is_active = active_prop["checkbox"]

            # Extract description (rich text)
            description = None
            desc_prop = props.get("Description") or props.get("Notes") or props.get("description") or props.get("notes") or {}
            if desc_prop.get("rich_text"):
                description = desc_prop["rich_text"][0]["text"]["content"]

            # Extract frequency (select field)
            frequency = "DAILY"
            freq_prop = props.get("Frequency") or props.get("frequency") or {}
            if freq_prop.get("select"):
                frequency = freq_prop["select"]["name"]

            # Extract language (select field)
            language = None
            lang_prop = props.get("Language") or props.get("language") or {}
            if lang_prop.get("select"):
                language = lang_prop["select"]["name"]

            # Extract count from metadata (number field)
            count = 3
            count_prop = props.get("Count") or props.get("count") or {}
            if count_prop.get("number"):
                count = count_prop["number"]

            sources.append({
                "notion_page_id": page["id"],
                "name": name,
                "url": url,
                "notion_type": notion_type,
                "is_active": is_active,
                "description": description,
                "frequency": frequency,
                "language": language,
                "count": count,
            })

            print(f"[sync_sources] Parsed source: {name} ({url})")

        except Exception as e:
            print(f"[sync_sources] Error parsing source page: {e}")
            traceback.print_exc()

    print(f"[sync_sources] Fetched {len(sources)} sources from Notion")
    return sources


def upsert_source(conn, source: dict, dry_run: bool = False) -> bool:
    """
    Upsert a source into PostgreSQL content.source table.

    Args:
        conn: SQLAlchemy connection
        source: Source dictionary from Notion
        dry_run: If True, don't actually write to database

    Returns:
        True if successful, False otherwise
    """
    url = source["url"]
    name = source["name"]
    notion_type = source.get("notion_type")
    is_active = source.get("is_active", True)
    description = source.get("description")
    frequency = source.get("frequency", "DAILY")
    language = source.get("language")
    count = source.get("count", 3)
    notion_page_id = source.get("notion_page_id")

    # Map Notion type to PostgreSQL type
    pg_type = map_notion_type(notion_type, url)

    # Compute URL hash for deduplication
    url_hash = compute_url_hash(url)

    # Build source_meta_json
    source_meta = {"count": count}
    if notion_type:
        source_meta["notion_type"] = notion_type

    if dry_run:
        print(f"[sync_sources] DRY RUN: Would upsert source: {name} ({url}) as {pg_type}")
        return True

    # Check if source already exists (by url_handle_hash)
    existing = conn.execute(text("""
        SELECT id FROM content.source WHERE url_handle_hash = :url_hash
    """), {"url_hash": url_hash}).fetchone()

    now = datetime.utcnow()

    if existing:
        # Update existing source
        conn.execute(text("""
            UPDATE content.source
            SET
                name = :name,
                type = :type,
                is_active = :is_active,
                description = COALESCE(:description, description),
                frequency = :frequency,
                language = COALESCE(:language, language),
                source_meta_json = :source_meta,
                external_source_id = :external_source_id,
                updated_at = :now
            WHERE id = :id
        """), {
            "id": existing.id,
            "name": name,
            "type": pg_type,
            "is_active": is_active,
            "description": description,
            "frequency": frequency,
            "language": language,
            "source_meta": source_meta,
            "external_source_id": notion_page_id,
            "now": now,
        })
        print(f"[sync_sources] Updated source: {name} ({url})")
    else:
        # Insert new source
        conn.execute(text("""
            INSERT INTO content.source (
                id, type, name, url_handle, url_handle_hash,
                is_active, description, frequency, language,
                source_meta_json, external_source_id,
                consecutive_failures, total_fetches, total_failures, is_healthy,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), :type, :name, :url_handle, :url_hash,
                :is_active, :description, :frequency, :language,
                :source_meta, :external_source_id,
                0, 0, 0, TRUE,
                :now, :now
            )
        """), {
            "type": pg_type,
            "name": name,
            "url_handle": url,
            "url_hash": url_hash,
            "is_active": is_active,
            "description": description,
            "frequency": frequency,
            "language": language,
            "source_meta": source_meta,
            "external_source_id": notion_page_id,
            "now": now,
        })
        print(f"[sync_sources] Inserted new source: {name} ({url})")

    return True


def log_sync_result(conn, status: str, sources_count: int, message: str = None):
    """
    Log sync result to core.run_log table.

    Args:
        conn: SQLAlchemy connection
        status: Status string (success, error, partial)
        sources_count: Number of sources synced
        message: Optional message
    """
    try:
        conn.execute(text("""
            INSERT INTO core.run_log (
                id, job_name, status, started_at, completed_at, records_processed, error_message
            ) VALUES (
                gen_random_uuid(), 'source_sync', :status, :now, :now, :count, :message
            )
        """), {
            "status": status,
            "now": datetime.utcnow(),
            "count": sources_count,
            "message": message,
        })
    except Exception as e:
        print(f"[sync_sources] Warning: Failed to log to run_log: {e}")


def sync_sources_from_notion(
    notion_database_id: str = None,
    dry_run: bool = False,
) -> dict:
    """
    Sync sources from Notion to PostgreSQL.

    Args:
        notion_database_id: Notion Sources database ID (uses env var if not provided)
        dry_run: If True, don't actually write to database

    Returns:
        Dict with sync results (total, created, updated, errors)
    """
    print("=" * 60)
    print("Syncing sources from Notion to PostgreSQL")
    print("=" * 60)

    # Get Notion database ID
    if not notion_database_id:
        notion_database_id = os.getenv("NOTION_SOURCES_DATABASE_ID")

    if not notion_database_id:
        print("[sync_sources] Error: NOTION_SOURCES_DATABASE_ID not set")
        return {"error": "NOTION_SOURCES_DATABASE_ID not configured"}

    # Initialize Notion agent
    notion_api_key = os.getenv("NOTION_TOKEN")
    if not notion_api_key:
        print("[sync_sources] Error: NOTION_TOKEN not set")
        return {"error": "NOTION_TOKEN not configured"}

    notion_agent = NotionAgent(notion_api_key)

    # Fetch sources from Notion
    try:
        notion_sources = fetch_notion_sources(notion_agent, notion_database_id)
    except Exception as e:
        print(f"[sync_sources] Error fetching from Notion: {e}")
        traceback.print_exc()
        return {"error": str(e)}

    if not notion_sources:
        print("[sync_sources] No sources found in Notion")
        return {"total": 0, "synced": 0, "errors": 0}

    # Sync to PostgreSQL
    engine = create_db_engine()
    results = {"total": len(notion_sources), "synced": 0, "errors": 0}

    try:
        with engine.begin() as conn:
            for source in notion_sources:
                try:
                    success = upsert_source(conn, source, dry_run)
                    if success:
                        results["synced"] += 1
                    else:
                        results["errors"] += 1
                except Exception as e:
                    print(f"[sync_sources] Error upserting source {source['name']}: {e}")
                    results["errors"] += 1

            # Log sync result
            if not dry_run:
                status = "success" if results["errors"] == 0 else "partial"
                log_sync_result(
                    conn,
                    status=status,
                    sources_count=results["synced"],
                    message=f"Synced {results['synced']}/{results['total']} sources"
                )

    except Exception as e:
        print(f"[sync_sources] Database error: {e}")
        traceback.print_exc()
        results["error"] = str(e)
        return results

    print("=" * 60)
    print(f"Sync complete: {results['synced']}/{results['total']} sources synced, {results['errors']} errors")
    print("=" * 60)

    return results


def main():
    """Main entry point for sync script."""
    parser = argparse.ArgumentParser(description="Sync sources from Notion to PostgreSQL")
    parser.add_argument(
        "--database-id",
        help="Notion Sources database ID (overrides NOTION_SOURCES_DATABASE_ID env var)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without writing to database (preview changes)"
    )
    args = parser.parse_args()

    result = sync_sources_from_notion(
        notion_database_id=args.database_id,
        dry_run=args.dry_run,
    )

    if "error" in result:
        exit(1)


if __name__ == "__main__":
    main()
