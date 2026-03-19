"""Integration tests for Story 1.2 — verify all 16 tables and indexes exist.

Requires a running PostgreSQL instance with the evidence layer schema applied.
Skip automatically if DATABASE_URL is not set or PostgreSQL is unreachable.

Run with:
    poetry run pytest tests/integration/test_database_schema.py -v
"""

import os
import subprocess
from pathlib import Path

import psycopg
import pytest

DATABASE_URL = os.environ.get("DATABASE_URL", "")

EXPECTED_TABLES = [
    # Newly Discovered pipeline
    "raw_html_archive",
    "notion_news_backup",
    "reviewers",
    "data_sources",
    # Books / Evidence pipeline (actual DB names)
    "books",
    "chapters",
    "sections",
    "idea_groups",
    "paragraph_chunks",
    "key_ideas",
    "evidence_metadata",
    "paragraph_embeddings",
    # Operations
    "processing_progress",
    "pipeline_runs",
    "failed_items",
    "knowledge_verification_contributors",
]

EXPECTED_INDEXES = [
    # Newly Discovered pipeline
    "idx_raw_html_content_hash",
    "idx_notion_backup_page_id",
    "idx_data_sources_url",
    "idx_data_sources_follow",
    "idx_data_sources_site_status",
    "idx_reviewers_notion_user_id",
    # Books / Evidence pipeline
    "idx_books_status",
    "idx_books_section",
    "idx_chapters_document",
    "idx_sections_document",
    "idx_sections_chapter",
    "idx_idea_groups_canonical",
    "idx_paragraph_chunks_extracted_concept",
    "idx_paragraph_chunks_idea_group",
    "idx_paragraph_chunks_paragraph_hash",
    "idx_paragraph_chunks_simhash64",
    "idx_paragraph_embeddings_handbook_topic",
    # Operations
    "idx_contributors_active",
    "idx_contributors_contributions",
]

SQL_SCRIPT = Path(__file__).parent.parent.parent / "scripts" / "setup_evidence_layer.sql"


def _postgres_available() -> bool:
    if not DATABASE_URL:
        return False
    try:
        with psycopg.connect(DATABASE_URL, connect_timeout=3):
            return True
    except Exception:
        return False


pytestmark = pytest.mark.integration

skip_if_unavailable = pytest.mark.skipif(
    not _postgres_available(),
    reason="DATABASE_URL not set or PostgreSQL unreachable — skipping integration tests",
)


@skip_if_unavailable
def test_all_16_tables_exist() -> None:
    """AC1/AC6: All 16 expected tables exist in the public schema."""
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        ).fetchall()
    existing = {row[0] for row in rows}
    missing = set(EXPECTED_TABLES) - existing
    assert not missing, f"Missing tables: {sorted(missing)}"


@skip_if_unavailable
def test_idempotency() -> None:
    """AC3: Running setup_evidence_layer.sql twice produces no errors."""
    assert SQL_SCRIPT.exists(), f"SQL script not found: {SQL_SCRIPT}"
    for run in range(1, 3):
        result = subprocess.run(
            ["psql", DATABASE_URL, "-f", str(SQL_SCRIPT)],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        assert result.returncode == 0, (
            f"Run {run}: SQL script exited with code {result.returncode}\n{result.stderr}"
        )
        assert "ERROR" not in result.stderr, (
            f"Run {run}: ERROR found in psql output:\n{result.stderr}"
        )


@skip_if_unavailable
def test_all_indexes_exist() -> None:
    """AC2: All expected indexes exist (ivfflat deferred to Story 1.3)."""
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
        ).fetchall()
    existing = {row[0] for row in rows}
    missing = set(EXPECTED_INDEXES) - existing
    assert not missing, f"Missing indexes: {sorted(missing)}"


@skip_if_unavailable
def test_vector_extension_installed() -> None:
    """AC1: pgvector extension is installed (required for paragraph_embeddings.embedding)."""
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "SELECT extname FROM pg_extension WHERE extname = 'vector'"
        ).fetchone()
    assert row is not None, "pgvector extension is not installed"


@skip_if_unavailable
def test_books_table_columns() -> None:
    """AC1: books table has the expected columns including source_type, handbook_section."""
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'books'"
        ).fetchall()
    cols = {row[0] for row in rows}
    required = {"id", "title", "author", "source_path", "source_type",
                "source_url", "handbook_section", "processing_status",
                "total_paragraphs", "paragraphs_processed", "llm_tokens_used",
                "llm_cost_cents", "created_at"}
    missing = required - cols
    assert not missing, f"books missing columns: {sorted(missing)}"


@skip_if_unavailable
def test_paragraph_chunks_concept_linkage_columns() -> None:
    """AC1: paragraph_chunks has all concept-linkage and cost-tracking columns (D3 decision)."""
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'paragraph_chunks'"
        ).fetchall()
    cols = {row[0] for row in rows}
    required = {"idea_group_id", "extracted_concept", "extraction_confidence",
                "importance_score", "sampling_weight", "cluster_id",
                "is_representative", "llm_tokens_used", "llm_cost_cents", "llm_provider"}
    missing = required - cols
    assert not missing, f"paragraph_chunks missing columns: {sorted(missing)}"


@skip_if_unavailable
def test_paragraph_embeddings_vector_column() -> None:
    """AC1: paragraph_embeddings has vector(1536) embedding column and handbook_topic."""
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'paragraph_embeddings'"
        ).fetchall()
    cols = {row[0] for row in rows}
    assert "embedding" in cols, "paragraph_embeddings missing embedding column"
    assert "handbook_topic" in cols, "paragraph_embeddings missing handbook_topic column (D4)"
