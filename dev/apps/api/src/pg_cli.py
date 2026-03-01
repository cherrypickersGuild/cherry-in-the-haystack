import os
import json
import uuid
from datetime import datetime
from typing import Optional

import psycopg2
import psycopg2.extras


class PGClient:
    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            host = os.getenv("PG_HOST", "postgres")
            port = os.getenv("PG_PORT", "5432")
            user = os.getenv("PG_USER", "autonews")
            password = os.getenv("PG_PASSWORD", "autonews")
            db = os.getenv("PG_DATABASE", "autonews")
            self.database_url = f"postgresql://{user}:{password}@{host}:{port}/{db}"

        print(f"PGClient initialized with url: {self.database_url.split('@')[-1]}")

    def connect(self):
        return psycopg2.connect(self.database_url)

    # ================================================================
    # patches table (migrated from mysql_cli.py)
    # ================================================================
    def patch_table_load(self):
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute("SELECT id, name, order_id, created_at FROM patches")
                rows = c.fetchall()
                ret = {}
                for row in rows:
                    order_id = row[2]
                    ret[order_id] = {
                        "name": row[1],
                        "order_id": row[2],
                        "created_at": row[3],
                    }
                return ret
        finally:
            conn.close()

    def patch_table_insert(self, name, order_id):
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO patches (name, order_id) VALUES (%s, %s)",
                    (name, order_id)
                )
            conn.commit()
            print(f"Patch table insertion: name {name}, order_id {order_id}")
        finally:
            conn.close()

    # ================================================================
    # index_pages table (migrated from mysql_cli.py)
    # ================================================================
    def index_pages_table_load(self):
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute("SELECT id, category, name, index_id, created_at, updated_at FROM index_pages")
                rows = c.fetchall()
                ret = {}
                for row in rows:
                    category = row[1]
                    name = row[2]
                    ret[category] = ret.get(category) or {}
                    ret[category][name] = {
                        "index_id": row[3],
                        "created_at": row[4],
                        "updated_at": row[5],
                    }
                return ret
        finally:
            conn.close()

    def index_pages_table_insert(self, category, name, index_id):
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO index_pages (category, name, index_id) VALUES (%s, %s, %s)",
                    (category, name, index_id)
                )
            conn.commit()
            print(f"Index_pages table insertion: category: {category}, name: {name}, index_id {index_id}")
        finally:
            conn.close()

    # ================================================================
    # articles table
    # ================================================================
    def save_article(self, article: dict) -> Optional[int]:
        """Save a processed article to PostgreSQL."""
        conn = self.connect()
        try:
            c = conn.cursor()
            c.execute("""
                INSERT INTO articles (
                    article_hash, source, list_name, category,
                    title, url, content, summary,
                    why_it_matters, insights, examples,
                    categories, tags, relevant_score,
                    published_at, notion_synced, notion_page_id
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                )
                ON CONFLICT (article_hash) DO UPDATE SET
                    summary = EXCLUDED.summary,
                    why_it_matters = EXCLUDED.why_it_matters,
                    insights = EXCLUDED.insights,
                    examples = EXCLUDED.examples,
                    categories = EXCLUDED.categories,
                    relevant_score = EXCLUDED.relevant_score,
                    notion_synced = EXCLUDED.notion_synced,
                    notion_page_id = EXCLUDED.notion_page_id,
                    updated_at = NOW()
                RETURNING id
            """, (
                article.get("id", ""),
                article.get("source", ""),
                article.get("list_name", ""),
                article.get("__feed_category", ""),
                article.get("title", ""),
                article.get("url", ""),
                article.get("content", ""),
                article.get("__summary", ""),
                article.get("__why_it_matters", ""),
                json.dumps(article.get("__insights", []), ensure_ascii=False),
                json.dumps(article.get("__examples", []), ensure_ascii=False),
                json.dumps(article.get("__categories", []), ensure_ascii=False),
                json.dumps(article.get("tags", []), ensure_ascii=False),
                article.get("__relevant_score"),
                article.get("created_time"),
                article.get("__notion_synced", False),
                article.get("__notion_page_id"),
            ))
            result = c.fetchone()
            conn.commit()
            c.close()
            return result[0] if result else None
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] save_article failed: {e}")
            return None
        finally:
            conn.close()

    def save_articles(self, articles: list) -> dict:
        """Save multiple articles. Returns stats."""
        stats = {"total": len(articles), "saved": 0, "error": 0}
        for article in articles:
            result = self.save_article(article)
            if result is not None:
                stats["saved"] += 1
            else:
                stats["error"] += 1
        return stats

    def get_articles(
        self,
        source: Optional[str] = None,
        category: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        page: int = 1,
        size: int = 20,
        sort_by: str = "published_at",
        order: str = "desc",
    ) -> dict:
        """Get articles with filtering and pagination."""
        allowed_sort = {"published_at", "created_at", "relevant_score", "title"}
        if sort_by not in allowed_sort:
            sort_by = "published_at"
        if order not in ("asc", "desc"):
            order = "desc"

        conditions = []
        params = []

        if source:
            conditions.append("source = %s")
            params.append(source)
        if category:
            conditions.append("category = %s")
            params.append(category)
        if from_date:
            conditions.append("published_at >= %s")
            params.append(from_date)
        if to_date:
            conditions.append("published_at <= %s")
            params.append(to_date)

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        offset = (page - 1) * size

        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                # Count
                c.execute(f"SELECT COUNT(*) as total FROM articles {where_clause}", params)
                total = c.fetchone()["total"]

                # Data
                c.execute(
                    f"""SELECT id, article_hash, source, list_name, category,
                               title, url, summary, why_it_matters,
                               insights, examples, categories, tags,
                               relevant_score, published_at, created_at,
                               notion_synced, notion_page_id
                        FROM articles {where_clause}
                        ORDER BY {sort_by} {order}
                        LIMIT %s OFFSET %s""",
                    params + [size, offset]
                )
                rows = c.fetchall()

                return {
                    "total": total,
                    "page": page,
                    "size": size,
                    "items": [dict(row) for row in rows],
                }
        finally:
            conn.close()

    def get_article_by_hash(self, article_hash: str) -> Optional[dict]:
        """Get a single article by hash."""
        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                c.execute(
                    """SELECT id, article_hash, source, list_name, category,
                              title, url, content, summary, why_it_matters,
                              insights, examples, categories, tags,
                              relevant_score, published_at, created_at,
                              notion_synced, notion_page_id
                       FROM articles WHERE article_hash = %s""",
                    (article_hash,)
                )
                row = c.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def search_articles(self, query: str, page: int = 1, size: int = 20) -> dict:
        """Full-text search using PostgreSQL tsvector + pg_trgm."""
        offset = (page - 1) * size

        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                # Use plainto_tsquery for simple queries, websearch_to_tsquery for advanced
                c.execute(
                    """SELECT id, article_hash, source, list_name, category,
                              title, url, summary, why_it_matters,
                              relevant_score, published_at, created_at,
                              ts_rank(search_vector, websearch_to_tsquery('english', %s)) AS rank
                       FROM articles
                       WHERE search_vector @@ websearch_to_tsquery('english', %s)
                          OR title %% %s
                       ORDER BY rank DESC
                       LIMIT %s OFFSET %s""",
                    (query, query, query, size, offset)
                )
                rows = c.fetchall()

                # Count
                c.execute(
                    """SELECT COUNT(*) as total FROM articles
                       WHERE search_vector @@ websearch_to_tsquery('english', %s)
                          OR title %% %s""",
                    (query, query)
                )
                total = c.fetchone()["total"]

                return {
                    "total": total,
                    "page": page,
                    "size": size,
                    "query": query,
                    "items": [dict(row) for row in rows],
                }
        finally:
            conn.close()

    def get_article_stats(self) -> dict:
        """Get aggregate statistics."""
        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                c.execute("""
                    SELECT
                        COUNT(*) as total_articles,
                        COUNT(DISTINCT source) as source_count,
                        COUNT(DISTINCT list_name) as feed_count,
                        COUNT(*) FILTER (WHERE notion_synced = true) as notion_synced,
                        MIN(published_at) as earliest_article,
                        MAX(published_at) as latest_article
                    FROM articles
                """)
                overview = dict(c.fetchone())

                c.execute("""
                    SELECT source, COUNT(*) as count
                    FROM articles
                    GROUP BY source
                    ORDER BY count DESC
                """)
                by_source = [dict(row) for row in c.fetchall()]

                c.execute("""
                    SELECT category, COUNT(*) as count
                    FROM articles
                    WHERE category IS NOT NULL
                    GROUP BY category
                    ORDER BY count DESC
                """)
                by_category = [dict(row) for row in c.fetchall()]

                return {
                    "overview": overview,
                    "by_source": by_source,
                    "by_category": by_category,
                }
        finally:
            conn.close()

    # ================================================================
    # feed_configs table
    # ================================================================
    def get_feed_configs(self, enabled_only: bool = False) -> list:
        """Get feed configurations."""
        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                if enabled_only:
                    c.execute("SELECT * FROM feed_configs WHERE enabled = true ORDER BY id")
                else:
                    c.execute("SELECT * FROM feed_configs ORDER BY id")
                return [dict(row) for row in c.fetchall()]
        finally:
            conn.close()

    def get_feed_config_by_id(self, feed_id: int) -> Optional[dict]:
        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                c.execute("SELECT * FROM feed_configs WHERE id = %s", (feed_id,))
                row = c.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def create_feed_config(self, feed: dict) -> int:
        """Create a new feed config. Returns the new id."""
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute("""
                    INSERT INTO feed_configs (name, url, source_type, category, enabled, count, config)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    feed["name"],
                    feed["url"],
                    feed.get("source_type", "rss"),
                    feed.get("category"),
                    feed.get("enabled", True),
                    feed.get("count", 3),
                    json.dumps(feed.get("config")) if feed.get("config") else None,
                ))
                new_id = c.fetchone()[0]
            conn.commit()
            return new_id
        finally:
            conn.close()

    def update_feed_config(self, feed_id: int, updates: dict) -> bool:
        """Update a feed config. Returns True if updated."""
        allowed_fields = {"name", "url", "source_type", "category", "enabled", "count", "config"}
        set_parts = []
        params = []

        for key, value in updates.items():
            if key not in allowed_fields:
                continue
            if key == "config":
                value = json.dumps(value) if value else None
            set_parts.append(f"{key} = %s")
            params.append(value)

        if not set_parts:
            return False

        set_parts.append("updated_at = NOW()")
        params.append(feed_id)

        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute(
                    f"UPDATE feed_configs SET {', '.join(set_parts)} WHERE id = %s",
                    params
                )
            conn.commit()
            return c.rowcount > 0
        finally:
            conn.close()

    def delete_feed_config(self, feed_id: int) -> bool:
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute("DELETE FROM feed_configs WHERE id = %s", (feed_id,))
            conn.commit()
            return c.rowcount > 0
        finally:
            conn.close()

    # ================================================================
    # job_runs table
    # ================================================================
    def record_job_start(self, job_name: str) -> str:
        """Record a job start. Returns run_id."""
        run_id = f"{job_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute(
                    "INSERT INTO job_runs (job_name, run_id, status) VALUES (%s, %s, 'running')",
                    (job_name, run_id)
                )
            conn.commit()
            return run_id
        finally:
            conn.close()

    def record_job_success(self, run_id: str, stats: Optional[dict] = None):
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute(
                    """UPDATE job_runs
                       SET status = 'success', finished_at = NOW(), stats = %s
                       WHERE run_id = %s""",
                    (json.dumps(stats) if stats else None, run_id)
                )
            conn.commit()
        finally:
            conn.close()

    def record_job_failure(self, run_id: str, error_msg: str):
        conn = self.connect()
        try:
            with conn.cursor() as c:
                c.execute(
                    """UPDATE job_runs
                       SET status = 'failed', finished_at = NOW(), error_msg = %s
                       WHERE run_id = %s""",
                    (error_msg, run_id)
                )
            conn.commit()
        finally:
            conn.close()

    def get_job_runs(
        self,
        job_name: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> dict:
        offset = (page - 1) * size
        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                if job_name:
                    c.execute(
                        """SELECT * FROM job_runs
                           WHERE job_name = %s
                           ORDER BY started_at DESC
                           LIMIT %s OFFSET %s""",
                        (job_name, size, offset)
                    )
                else:
                    c.execute(
                        "SELECT * FROM job_runs ORDER BY started_at DESC LIMIT %s OFFSET %s",
                        (size, offset)
                    )
                rows = c.fetchall()

                # Count
                if job_name:
                    c.execute("SELECT COUNT(*) as total FROM job_runs WHERE job_name = %s", (job_name,))
                else:
                    c.execute("SELECT COUNT(*) as total FROM job_runs")
                total = c.fetchone()["total"]

                return {
                    "total": total,
                    "page": page,
                    "size": size,
                    "items": [dict(row) for row in rows],
                }
        finally:
            conn.close()

    def get_latest_job_run(self, job_name: str) -> Optional[dict]:
        conn = self.connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as c:
                c.execute(
                    "SELECT * FROM job_runs WHERE job_name = %s ORDER BY started_at DESC LIMIT 1",
                    (job_name,)
                )
                row = c.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()
