"""psycopg3 connection pool (max 20) with context manager."""

from __future__ import annotations

import os
from types import TracebackType
from typing import Any, cast

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

MAX_POOL_SIZE: int = 20


class PostgresDB:
    """Connection-pooled PostgreSQL client using psycopg3.

    Usage::

        db = PostgresDB(dsn="postgresql://user:pass@localhost/db")
        rows = db.fetch_all("SELECT * FROM books WHERE processing_status = %s", ["pending"])
        db.close()

        # Or as a context manager:
        with PostgresDB(dsn) as db:
            db.execute("INSERT INTO pipeline_runs (job_name) VALUES (%s)", ["news-ingestion"])
    """

    def __init__(self, dsn: str) -> None:
        self._pool: ConnectionPool[psycopg.Connection[Any]] = ConnectionPool(
            conninfo=dsn,
            min_size=1,
            max_size=MAX_POOL_SIZE,
            kwargs={"row_factory": dict_row},
        )

    def execute(self, query: str, params: Any = None) -> None:
        """Execute a write query (INSERT / UPDATE / DELETE). Commits automatically."""
        with self._pool.connection() as conn:
            conn.execute(query, params)

    def fetch_one(self, query: str, params: Any = None) -> dict[str, Any] | None:
        """Execute a query and return the first row as a dict, or None if no rows."""
        with self._pool.connection() as conn:
            row = conn.execute(query, params).fetchone()
            if row is None:
                return None
            return cast(dict[str, Any], row)

    def fetch_all(self, query: str, params: Any = None) -> list[dict[str, Any]]:
        """Execute a query and return all rows as a list of dicts."""
        with self._pool.connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return cast(list[dict[str, Any]], rows)

    def close(self) -> None:
        """Close the connection pool and release all connections."""
        self._pool.close()

    def __enter__(self) -> PostgresDB:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        self.close()


def get_db() -> PostgresDB:
    """Create a PostgresDB instance from the DATABASE_URL environment variable."""
    dsn = os.environ["DATABASE_URL"]
    return PostgresDB(dsn)
