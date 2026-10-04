"""
Unit tests for api.db.client helpers that don't require a real database.

Test coverage:
  C.1 — _get_pool() raises RuntimeError when pool is not initialized
  C.2 — init_pool() normalizes postgresql+asyncpg:// → postgresql:// before connecting
  C.3 — init_pool() passes through plain postgresql:// DSN unchanged
  C.4 — close_pool() closes the pool and resets internal state to None
  C.5 — close_pool() is a no-op when called before init_pool()
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import api.db.client as db_client


# ---------------------------------------------------------------------------
# C.1 — _get_pool() without init
# ---------------------------------------------------------------------------

class TestGetPoolNotInitialized:
    def test_raises_runtime_error_when_pool_is_none(self):
        with patch.object(db_client, "_pool", None):
            with pytest.raises(RuntimeError, match="not initialized"):
                db_client._get_pool()

    def test_error_message_mentions_init_pool(self):
        with patch.object(db_client, "_pool", None):
            with pytest.raises(RuntimeError, match="init_pool"):
                db_client._get_pool()

    def test_returns_pool_when_initialized(self):
        mock_pool = MagicMock()
        with patch.object(db_client, "_pool", mock_pool):
            result = db_client._get_pool()
        assert result is mock_pool


# ---------------------------------------------------------------------------
# C.2 / C.3 — init_pool() DSN normalization
# ---------------------------------------------------------------------------

class TestInitPoolDsnNormalization:
    async def test_normalizes_asyncpg_dsn_to_plain_postgresql(self):
        mock_pool = AsyncMock()
        with patch("api.db.client.asyncpg.create_pool", new=AsyncMock(return_value=mock_pool)) as mock_create:
            await db_client.init_pool("postgresql+asyncpg://user:pass@localhost/mydb")

        dsn_used = mock_create.call_args[0][0]
        assert dsn_used.startswith("postgresql://")
        assert "+asyncpg" not in dsn_used

    async def test_plain_postgresql_dsn_passed_through_unchanged(self):
        mock_pool = AsyncMock()
        with patch("api.db.client.asyncpg.create_pool", new=AsyncMock(return_value=mock_pool)) as mock_create:
            await db_client.init_pool("postgresql://user:pass@localhost/mydb")

        dsn_used = mock_create.call_args[0][0]
        assert dsn_used == "postgresql://user:pass@localhost/mydb"

    async def test_sets_internal_pool_after_init(self):
        mock_pool = MagicMock()
        with patch("api.db.client.asyncpg.create_pool", new=AsyncMock(return_value=mock_pool)):
            await db_client.init_pool("postgresql://localhost/db")

        assert db_client._pool is mock_pool
        # cleanup
        db_client._pool = None

    async def test_create_pool_called_with_pool_size_limits(self):
        mock_pool = MagicMock()
        with patch("api.db.client.asyncpg.create_pool", new=AsyncMock(return_value=mock_pool)) as mock_create:
            await db_client.init_pool("postgresql://localhost/db")

        call_kwargs = mock_create.call_args[1]
        assert "min_size" in call_kwargs
        assert "max_size" in call_kwargs
        # cleanup
        db_client._pool = None


# ---------------------------------------------------------------------------
# C.4 / C.5 — close_pool()
# ---------------------------------------------------------------------------

class TestClosePool:
    async def test_closes_pool_and_resets_to_none(self):
        mock_pool = AsyncMock()
        with patch.object(db_client, "_pool", mock_pool):
            await db_client.close_pool()

        mock_pool.close.assert_awaited_once()
        assert db_client._pool is None

    async def test_noop_when_pool_not_initialized(self):
        with patch.object(db_client, "_pool", None):
            await db_client.close_pool()
        # No exception raised — correct behaviour
