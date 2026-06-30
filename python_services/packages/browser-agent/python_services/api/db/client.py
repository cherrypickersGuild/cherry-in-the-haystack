"""
asyncpg-based database helpers for crawler operations.

Connection pool lifecycle:
  - init_pool(dsn) is called once from the FastAPI lifespan (main.py).
  - close_pool() is called on app shutdown.
  - All query functions acquire a connection from the pool per call.

CRITICAL — schema assumptions:
  Column names for core.run_log and core.prompt_template_version are inferred from
  common patterns in cherry-in-the-haystack. Verify against:
    cherry-in-the-haystack/docs/architecture/ddl-v1.1.sql
  before deploying. Adjust column names here if they differ.

UUID v7:
  All new primary keys use uuid7. Package: `uuid7` (PyPI).
  Fallback: `uuid6` package also exports uuid7().
"""

from __future__ import annotations

import json
from typing import Optional
from uuid import UUID

import asyncpg

try:
    # The `uuid7` PyPI package installs as `uuid_extensions`
    from uuid_extensions import uuid7 as _uuid7_fn

    def _new_uuid() -> UUID:
        return UUID(str(_uuid7_fn()))

except ImportError:
    # Fallback: some deployments use the `uuid6` package which also exports uuid7
    try:
        from uuid6 import uuid7 as _uuid7_fn  # type: ignore[no-redef]

        def _new_uuid() -> UUID:  # type: ignore[misc]
            return UUID(str(_uuid7_fn()))

    except ImportError:
        import uuid as _uuid_std

        def _new_uuid() -> UUID:  # type: ignore[misc]
            return _uuid_std.uuid4()


_pool: Optional[asyncpg.Pool] = None


async def init_pool(dsn: str) -> None:
    global _pool
    # asyncpg expects plain postgresql:// DSN, not postgresql+asyncpg://
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    # statement_cache_size=0: required when connecting via PgBouncer in transaction mode.
    # min_size/max_size: keeps pool well under Supabase pooler's 15-connection cap.
    _pool = await asyncpg.create_pool(
        dsn,
        min_size=2,
        max_size=8,
        statement_cache_size=0,
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized — call init_pool() first")
    return _pool


def _parse_jsonb(value: object) -> dict:
    """
    Normalise a JSONB column value to a dict.
    asyncpg returns JSONB as a raw JSON string (no codec registered), but some
    configurations return a dict — handle both.
    """
    if isinstance(value, str):
        return json.loads(value)
    return dict(value)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# crawler_analysis
# ---------------------------------------------------------------------------

async def get_source(source_id: UUID) -> Optional[dict]:
    """Return {id, url_handle} for the source, or None if it does not exist."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, url_handle FROM content.source WHERE id = $1",
            source_id,
        )
    if row is None:
        return None
    return {"id": row["id"], "url_handle": row["url_handle"]}


async def get_crawler_analysis(source_id: UUID) -> Optional[dict]:
    """Return existing analysis row for source_id, or None if absent."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, analysis_json FROM content.crawler_analysis WHERE source_id = $1",
            source_id,
        )
    if row is None:
        return None
    return {"id": row["id"], "analysis_json": _parse_jsonb(row["analysis_json"])}


async def upsert_crawler_analysis(
    source_id: UUID,
    analysis_json: dict,
    prompt_template_version_id: Optional[UUID],
    run_log_id: Optional[UUID],
    model_name: Optional[str],
) -> UUID:
    """
    INSERT or UPDATE crawler_analysis on conflict with the unique index on source_id.
    Returns the persisted row id (may differ from the generated id on conflict).
    """
    pool = _get_pool()
    new_id = _new_uuid()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO content.crawler_analysis
                (id, source_id, analysis_json, prompt_template_version_id, run_log_id, model_name)
            VALUES ($1, $2, $3::jsonb, $4, $5, $6)
            ON CONFLICT (source_id) DO UPDATE SET
                analysis_json              = EXCLUDED.analysis_json,
                prompt_template_version_id = EXCLUDED.prompt_template_version_id,
                run_log_id                 = EXCLUDED.run_log_id,
                model_name                 = EXCLUDED.model_name,
                updated_at                 = CURRENT_TIMESTAMP
            RETURNING id
            """,
            new_id,
            source_id,
            json.dumps(analysis_json),
            prompt_template_version_id,
            run_log_id,
            model_name,
        )
    return row["id"]


# ---------------------------------------------------------------------------
# run_log
# ---------------------------------------------------------------------------
# CRITICAL: verify column names against core.run_log in ddl-v1.1.sql.
# Assumed schema: id UUID PK, run_kind core.run_kind_enum, status VARCHAR/TEXT,
#                 created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()

async def create_run_log(run_kind: str, status: str) -> UUID:
    """Insert a new run_log row and return its id."""
    pool = _get_pool()
    new_id = _new_uuid()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO core.run_log (id, run_kind, status)
            VALUES ($1, $2::core.run_kind_enum, $3)
            """,
            new_id,
            run_kind,
            status,
        )
    return new_id


async def update_run_log(run_log_id: UUID, status: str) -> None:
    """Update run_log status and set updated_at to now."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE core.run_log
            SET status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            """,
            run_log_id,
            status,
        )


# ---------------------------------------------------------------------------
# prompt_template_version
# ---------------------------------------------------------------------------
# CRITICAL: verify column names against core.prompt_template_version in ddl-v1.1.sql.
# Assumed schema: id UUID PK, name VARCHAR, version VARCHAR, content TEXT,
#                 created_at TIMESTAMPTZ DEFAULT NOW()

async def get_or_create_prompt_version(
    prompt_name: str,
    prompt_version: str,
    prompt_content: str,
) -> Optional[UUID]:
    """
    Look up the latest prompt_template_version row by name.
    If absent, insert a new row and return its id.
    Returns None if the table does not exist (graceful fallback).
    """
    pool = _get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT id FROM core.prompt_template_version
                WHERE name = $1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                prompt_name,
            )
            if row is not None:
                return row["id"]
            new_id = _new_uuid()
            await conn.execute(
                """
                INSERT INTO core.prompt_template_version (id, name, version, content)
                VALUES ($1, $2, $3, $4)
                """,
                new_id,
                prompt_name,
                prompt_version,
                prompt_content,
            )
            return new_id
        except (asyncpg.UndefinedTableError, asyncpg.UndefinedColumnError):
            # Table missing OR its schema differs from what this code expects
            # (prompt_template_version is a normalized table in this DB).
            # prompt_template_version_id is a nullable audit FK, so fall back to NULL.
            return None


# ---------------------------------------------------------------------------
# crawler_registry
# ---------------------------------------------------------------------------

async def get_crawler_analysis_by_id(analysis_id: UUID) -> Optional[dict]:
    """Return analysis row by PK, or None if absent."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, analysis_json FROM content.crawler_analysis WHERE id = $1",
            analysis_id,
        )
    if row is None:
        return None
    return {"id": row["id"], "analysis_json": _parse_jsonb(row["analysis_json"])}


async def insert_crawler_registry(
    source_id: UUID,
    analysis_id: Optional[UUID],
    generated_code: str,
    run_log_id: Optional[UUID],
) -> UUID:
    """
    INSERT a new crawler_registry row with status='pending_review'.
    Pure INSERT — multiple pending_review rows per source_id are allowed.
    The partial unique index only covers status='active'.
    """
    pool = _get_pool()
    new_id = _new_uuid()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO content.crawler_registry
                (id, source_id, analysis_id, status, generated_code, run_log_id)
            VALUES ($1, $2, $3, 'pending_review', $4, $5)
            """,
            new_id,
            source_id,
            analysis_id,
            generated_code,
            run_log_id,
        )
    return new_id


async def get_active_crawler_registry(source_id: UUID) -> Optional[dict]:
    """
    Return the active crawler_registry row + source URL for source_id, or None.
    JOIN with content.source to fetch the crawl target URL.
    """
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT r.id, r.generated_code, s.url_handle AS source_url
            FROM content.crawler_registry r
            JOIN content.source s ON s.id = r.source_id
            WHERE r.source_id = $1 AND r.status = 'active'
            LIMIT 1
            """,
            source_id,
        )
    if row is None:
        return None
    return {
        "id": row["id"],
        "generated_code": row["generated_code"],
        "source_url": row["source_url"],
    }
