# Handbook Schema Alignment Report

**Generated:** 2026-04-07
**Purpose:** Align `text_extract_ideas` SQLAlchemy models with DDL v1.0 `handbook.*` schema
**Epic:** Epic 2 - Learn Structured Concepts (FR-3.2, FR-3.3, FR-7.2)

---

## Executive Summary

The `text_extract_ideas` package implements PDF/HTML → Evidence Layer pipeline (FR-3.2, FR-3.3) but uses **different table names** and **missing columns** compared to the canonical DDL v1.0 schema.

| Status | Count |
|--------|-------|
| Tables needing rename | 5 |
| Tables needing new columns | 4 |
| Missing tables (to create) | 6 |
| Total alignment actions | 15 |

---

## Table Mapping: Current → DDL

| Current (`text_extract_ideas`) | DDL v1.0 (`handbook.*`) | Action |
|-------------------------------|--------------------------|--------|
| `books` | `handbook.book` | Rename + add columns |
| `chapters` | `handbook.chapter` | Rename + add columns |
| `sections` | `handbook.section` | Rename + add columns |
| `paragraph_chunks` | `handbook.paragraph_chunk` | Rename + add columns |
| `idea_groups` | `handbook.idea_group` | Rename + align |
| `key_ideas` | `handbook.key_idea` | Rename + align |
| `processing_progress` | `handbook.processing_progress` | Rename + align |
| *(none)* | `handbook.paragraph_concept_link` | **CREATE NEW** |
| *(none)* | `handbook.evidence_metadata` | **CREATE NEW** |
| *(none)* | `handbook.paragraph_embedding` | **CREATE NEW** |
| *(none)* | `handbook.knowledge_verification_contributor` | **CREATE NEW** |

---

## Detailed Column Comparison

### 1. `books` → `handbook.book`

**Current (`text_extract_ideas`):**
```python
id (Integer, Sequence)
title (Text)
author (Text)
source_path (Text)
created_at (TIMESTAMP)
```

**DDL v1.0 (`handbook.book`):**
```sql
id (BIGSERIAL PRIMARY KEY)
title (TEXT NOT NULL)
author (TEXT)
source_path (TEXT)
source_type (VARCHAR(50))
source_url (TEXT)
handbook_section (VARCHAR(50)) -- NEW
processing_status (VARCHAR(20) DEFAULT 'pending') -- NEW
total_paragraphs (INTEGER) -- NEW
paragraphs_processed (INTEGER DEFAULT 0) -- NEW
llm_tokens_used (INTEGER DEFAULT 0) -- NEW
llm_cost_cents (NUMERIC(10,4) DEFAULT 0) -- NEW
created_at (TIMESTAMPTZ DEFAULT NOW())
```

**Gaps → Add:** `source_type`, `source_url`, `handbook_section`, `processing_status`, `total_paragraphs`, `paragraphs_processed`, `llm_tokens_used`, `llm_cost_cents`

---

### 2. `chapters` → `handbook.chapter`

**Current:**
```python
id, book_id, chapter_number, title, start_page, end_page, level, parent_chapter_id,
detection_method (VARCHAR(50)), created_at
```

**DDL v1.0:** ✅ **ALIGNED** (all columns match)

---

### 3. `sections` → `handbook.section`

**Current:**
```python
id, book_id, chapter_id, section_number, title, level, parent_section_id,
detection_method (VARCHAR(50) DEFAULT 'llm'), created_at
```

**DDL v1.0:** ✅ **ALIGNED** (all columns match)

---

### 4. `paragraph_chunks` → `handbook.paragraph_chunk`

**Current:**
```python
id, book_id, page_number, paragraph_index, body_text, created_at,
chapter_id, chapter_paragraph_index, section_id
```

**DDL v1.0:**
```sql
id (BIGSERIAL PRIMARY KEY)
book_id (BIGINT)
chapter_id (BIGINT)
section_id (BIGINT)
page_number (INTEGER)
paragraph_index (INTEGER)
body_text (TEXT NOT NULL)
paragraph_hash (TEXT) -- NEW
simhash64 (BIGINT) -- NEW
importance_score (NUMERIC(3,2)) -- NEW
sampling_weight (NUMERIC(3,2)) -- NEW
cluster_id (INTEGER) -- NEW
is_representative (BOOLEAN DEFAULT FALSE) -- NEW
llm_tokens_used (INTEGER) -- NEW
llm_cost_cents (NUMERIC(10,4)) -- NEW
llm_provider (VARCHAR(50)) -- NEW
created_at (TIMESTAMPTZ DEFAULT NOW())
```

**Gaps → Add:** `paragraph_hash`, `simhash64`, `importance_score`, `sampling_weight`, `cluster_id`, `is_representative`, `llm_tokens_used`, `llm_cost_cents`, `llm_provider`

---

### 5. `idea_groups` → `handbook.idea_group`

**Current:**
```python
id, canonical_idea_text, created_at
```

**DDL v1.0:** ✅ **ALIGNED**

---

### 6. `key_ideas` → `handbook.key_idea`

**Current:**
```python
id, chunk_id, book_id, core_idea_text, idea_group_id, created_at
```

**DDL v1.0:** ✅ **ALIGNED**

---

### 7. `processing_progress` → `handbook.processing_progress`

**Current:**
```python
id, book_id, page_number, status, error_message, attempt_count,
last_attempt_at, completed_at, created_at, updated_at,
chapter_id, processing_unit
```

**DDL v1.0:** ✅ **ALIGNED**

---

## New Tables to Create

### `handbook.paragraph_concept_link` (NEW)

```sql
CREATE TABLE handbook.paragraph_concept_link (
    id BIGSERIAL PRIMARY KEY,
    paragraph_chunk_id BIGINT NOT NULL,
    idea_group_id BIGINT NOT NULL,
    extracted_concept VARCHAR(200) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    extraction_confidence NUMERIC(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_paragraph_concept_link_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
            ON DELETE CASCADE,
    CONSTRAINT fk_paragraph_concept_link_idea_group
        FOREIGN KEY (idea_group_id) REFERENCES handbook.idea_group(id)
            ON DELETE RESTRICT,
    CONSTRAINT uq_paragraph_concept_link UNIQUE (paragraph_chunk_id, idea_group_id)
);
```

**Purpose:** Link extracted concepts to paragraph chunks for ontology extraction (FR-3.2)

---

### `handbook.evidence_metadata` (NEW)

```sql
CREATE TABLE handbook.evidence_metadata (
    id BIGSERIAL PRIMARY KEY,
    paragraph_chunk_id BIGINT,
    extract_type VARCHAR(50),
    keywords JSONB,
    entities JSONB,
    handbook_topic VARCHAR(100),
    handbook_subtopic VARCHAR(100),
    judge_originality NUMERIC(3,2),
    judge_depth NUMERIC(3,2),
    judge_technical_accuracy NUMERIC(3,2),

    CONSTRAINT fk_evidence_metadata_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
            ON DELETE NULL
);
```

**Purpose:** Store LLM-extracted metadata for evidence quality assessment (FR-2.3)

---

### `handbook.paragraph_embedding` (NEW)

```sql
CREATE TABLE handbook.paragraph_embedding (
    id BIGSERIAL PRIMARY KEY,
    paragraph_chunk_id BIGINT,
    book_id BIGINT,
    embedding vector(1536),
    body_text TEXT,
    handbook_topic VARCHAR(100),
    model TEXT DEFAULT 'text-embedding-3-small',
    embedding_cost_cents NUMERIC(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_paragraph_embedding_paragraph_chunk
        FOREIGN KEY (paragraph_chunk_id) REFERENCES handbook.paragraph_chunk(id)
            ON DELETE CASCADE,
    CONSTRAINT fk_paragraph_embedding_book
        FOREIGN KEY (book_id) REFERENCES handbook.book(id)
            ON DELETE SET NULL
);

-- Index for vector similarity search
CREATE INDEX idx_paragraph_embedding_vector
    ON handbook.paragraph_embedding
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

**Purpose:** Store embeddings for deduplication (FR-9.1) and semantic search

---

### `handbook.knowledge_verification_contributor` (NEW)

```sql
CREATE TABLE handbook.knowledge_verification_contributor (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    email TEXT,
    github_username TEXT,
    active BOOLEAN DEFAULT TRUE,
    contributions_count INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_contribution_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Track Knowledge Team contributors for study sessions (FR-3.3)

---

## Aligned SQLAlchemy Models

```python
# src/db/models_aligned.py
from sqlalchemy import Column, Integer, Text, ForeignKey, String, Sequence, \
    Boolean, BigInteger, Numeric, JSON, CheckConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP, VECTOR
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


# ============================================================
# handbook.book (renamed from books)
# ============================================================
class Book(Base):
    """책 정보 테이블 (handbook.book)"""

    __tablename__ = "book"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('book_id_seq'), primary_key=True)
    title = Column(Text, nullable=False)
    author = Column(Text)
    source_path = Column(Text)
    source_type = Column(String(50))
    source_url = Column(Text)
    handbook_section = Column(String(50))
    processing_status = Column(String(50), default='pending')
    total_paragraphs = Column(Integer)
    paragraphs_processed = Column(Integer, default=0)
    llm_tokens_used = Column(Integer, default=0)
    llm_cost_cents = Column(Numeric(10, 4), default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("processing_status IN ('pending', 'processing', 'completed', 'failed')",
                       name='chk_book_processing_status'),
    )


# ============================================================
# handbook.chapter (renamed from chapters)
# ============================================================
class Chapter(Base):
    """챕터 정보 테이블 (handbook.chapter)"""

    __tablename__ = "chapter"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('chapter_id_seq'), primary_key=True)
    book_id = Column(BigInteger, ForeignKey("handbook.book.id", ondelete="CASCADE"), nullable=False)
    chapter_number = Column(Integer)
    title = Column(Text)
    start_page = Column(Integer)
    end_page = Column(Integer)
    level = Column(Integer, default=1)
    parent_chapter_id = Column(BigInteger, ForeignKey("handbook.chapter.id", ondelete="SET NULL"))
    detection_method = Column(String(50))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# handbook.section (renamed from sections)
# ============================================================
class Section(Base):
    """섹션 정보 테이블 (handbook.section)"""

    __tablename__ = "section"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('section_id_seq'), primary_key=True)
    book_id = Column(BigInteger, ForeignKey("handbook.book.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(BigInteger, ForeignKey("handbook.chapter.id", ondelete="CASCADE"), nullable=False)
    section_number = Column(Integer)
    title = Column(Text, nullable=False)
    level = Column(Integer, default=1)
    parent_section_id = Column(BigInteger, ForeignKey("handbook.section.id", ondelete="SET NULL"))
    detection_method = Column(String(50), default='llm')
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# handbook.paragraph_chunk (renamed from paragraph_chunks)
# ============================================================
class ParagraphChunk(Base):
    """문단(청크) 테이블 (handbook.paragraph_chunk)"""

    __tablename__ = "paragraph_chunk"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('paragraph_chunk_id_seq'), primary_key=True)
    book_id = Column(BigInteger, ForeignKey("handbook.book.id", ondelete="SET NULL"))
    chapter_id = Column(BigInteger, ForeignKey("handbook.chapter.id", ondelete="SET NULL"))
    section_id = Column(BigInteger, ForeignKey("handbook.section.id", ondelete="SET NULL"))
    page_number = Column(Integer)
    paragraph_index = Column(Integer)
    chapter_paragraph_index = Column(Integer)
    body_text = Column(Text, nullable=False)

    # NEW: Deduplication & clustering
    paragraph_hash = Column(String)
    simhash64 = Column(BigInteger)
    importance_score = Column(Numeric(3, 2))
    sampling_weight = Column(Numeric(3, 2))
    cluster_id = Column(Integer)
    is_representative = Column(Boolean, default=False)

    # NEW: LLM cost tracking
    llm_tokens_used = Column(Integer)
    llm_cost_cents = Column(Numeric(10, 4))
    llm_provider = Column(String(50))

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# handbook.idea_group (renamed from idea_groups)
# ============================================================
class IdeaGroup(Base):
    """아이디어 묶음 (handbook.idea_group)"""

    __tablename__ = "idea_group"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('idea_group_id_seq'), primary_key=True)
    canonical_idea_text = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# handbook.key_idea (renamed from key_ideas)
# ============================================================
class KeyIdea(Base):
    """핵심 아이디어 테이블 (handbook.key_idea)"""

    __tablename__ = "key_idea"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('key_idea_id_seq'), primary_key=True)
    paragraph_chunk_id = Column(BigInteger, ForeignKey("handbook.paragraph_chunk.id", ondelete="SET NULL"))
    book_id = Column(BigInteger, ForeignKey("handbook.book.id", ondelete="SET NULL"))
    core_idea_text = Column(Text, nullable=False)
    idea_group_id = Column(BigInteger, ForeignKey("handbook.idea_group.id", ondelete="RESTRICT"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# handbook.processing_progress (renamed)
# ============================================================
class ProcessingProgress(Base):
    """처리 진행상황 테이블 (handbook.processing_progress)"""

    __tablename__ = "processing_progress"
    __table_args__ = {'schema': 'handbook'}

    id = Column(Integer, Sequence('processing_progress_id_seq'), primary_key=True)
    book_id = Column(BigInteger, ForeignKey("handbook.book.id", ondelete="SET NULL"))
    chapter_id = Column(BigInteger, ForeignKey("handbook.chapter.id", ondelete="SET NULL"))
    page_number = Column(Integer)
    status = Column(String(50))
    error_message = Column(Text)
    attempt_count = Column(Integer, default=0)
    last_attempt_at = Column(TIMESTAMP(timezone=True))
    completed_at = Column(TIMESTAMP(timezone=True))
    processing_unit = Column(String(50), default='page')
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


# ============================================================
# NEW: handbook.paragraph_concept_link
# ============================================================
class ParagraphConceptLink(Base):
    """Link paragraphs to extracted concepts for ontology"""

    __tablename__ = "paragraph_concept_link"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('paragraph_concept_link_id_seq'), primary_key=True)
    paragraph_chunk_id = Column(BigInteger, ForeignKey("handbook.paragraph_chunk.id", ondelete="CASCADE"), nullable=False)
    idea_group_id = Column(BigInteger, ForeignKey("handbook.idea_group.id", ondelete="RESTRICT"), nullable=False)
    extracted_concept = Column(String(200), nullable=False)
    is_primary = Column(Boolean, default=False)
    extraction_confidence = Column(Numeric(3, 2))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# NEW: handbook.evidence_metadata
# ============================================================
class EvidenceMetadata(Base):
    """LLM-extracted evidence metadata for quality assessment"""

    __tablename__ = "evidence_metadata"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('evidence_metadata_id_seq'), primary_key=True)
    paragraph_chunk_id = Column(BigInteger, ForeignKey("handbook.paragraph_chunk.id", ondelete="SET NULL"))
    extract_type = Column(String(50))
    keywords = Column(JSON)
    entities = Column(JSON)
    handbook_topic = Column(String(100))
    handbook_subtopic = Column(String(100))
    judge_originality = Column(Numeric(3, 2))
    judge_depth = Column(Numeric(3, 2))
    judge_technical_accuracy = Column(Numeric(3, 2))


# ============================================================
# NEW: handbook.paragraph_embedding
# ============================================================
class ParagraphEmbedding(Base):
    """Vector embeddings for deduplication (FR-9.1)"""

    __tablename__ = "paragraph_embedding"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('paragraph_embedding_id_seq'), primary_key=True)
    paragraph_chunk_id = Column(BigInteger, ForeignKey("handbook.paragraph_chunk.id", ondelete="CASCADE"))
    book_id = Column(BigInteger, ForeignKey("handbook.book.id", ondelete="SET NULL"))
    embedding = Column(VECTOR(1536))
    body_text = Column(Text)
    handbook_topic = Column(String(100))
    model = Column(Text, default='text-embedding-3-small')
    embedding_cost_cents = Column(Numeric(10, 4))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ============================================================
# NEW: handbook.knowledge_verification_contributor
# ============================================================
class KnowledgeVerificationContributor(Base):
    """Knowledge Team contributors for study sessions (FR-3.3)"""

    __tablename__ = "knowledge_verification_contributor"
    __table_args__ = {'schema': 'handbook'}

    id = Column(BigInteger, Sequence('knowledge_verification_contributor_id_seq'), primary_key=True)
    name = Column(Text, nullable=False, unique=True)
    email = Column(Text)
    github_username = Column(Text)
    active = Column(Boolean, default=True)
    contributions_count = Column(Integer, default=0)
    joined_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    last_contribution_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
```

---

## Migration SQL

```sql
-- ============================================================
-- Migration: Rename existing tables to handbook.* schema
-- ============================================================

-- 1. Rename tables (if they exist in public schema)
ALTER TABLE IF EXISTS books RENAME TO book;
ALTER TABLE IF EXISTS chapters RENAME TO chapter;
ALTER TABLE IF EXISTS sections RENAME TO section;
ALTER TABLE IF EXISTS paragraph_chunks RENAME TO paragraph_chunk;
ALTER TABLE IF EXISTS idea_groups RENAME TO idea_group;
ALTER TABLE IF EXISTS key_ideas RENAME TO key_idea;
ALTER TABLE IF EXISTS processing_progress RENAME TO processing_progress;

-- 2. Move to handbook schema
CREATE SCHEMA IF NOT EXISTS handbook;

ALTER TABLE book SET SCHEMA handbook;
ALTER TABLE chapter SET SCHEMA handbook;
ALTER TABLE section SET SCHEMA handbook;
ALTER TABLE paragraph_chunk SET SCHEMA handbook;
ALTER TABLE idea_group SET SCHEMA handbook;
ALTER TABLE key_idea SET SCHEMA handbook;
ALTER TABLE processing_progress SET SCHEMA handbook;

-- 3. Add missing columns to handbook.book
ALTER TABLE handbook.book
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS handbook_section VARCHAR(50),
    ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS total_paragraphs INTEGER,
    ADD COLUMN IF NOT EXISTS paragraphs_processed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS llm_tokens_used INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS llm_cost_cents NUMERIC(10,4) DEFAULT 0;

-- 4. Add missing columns to handbook.paragraph_chunk
ALTER TABLE handbook.paragraph_chunk
    ADD COLUMN IF NOT EXISTS paragraph_hash TEXT,
    ADD COLUMN IF NOT EXISTS simhash64 BIGINT,
    ADD COLUMN IF NOT EXISTS importance_score NUMERIC(3,2),
    ADD COLUMN IF NOT EXISTS sampling_weight NUMERIC(3,2),
    ADD COLUMN IF NOT EXISTS cluster_id INTEGER,
    ADD COLUMN IF NOT EXISTS is_representative BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS llm_tokens_used INTEGER,
    ADD COLUMN IF NOT EXISTS llm_cost_cents NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(50);

-- 5. Convert id columns to BIGSERIAL (requires data migration)
-- This is more complex - see script below

-- 6. Create new tables
-- (see DDL section above for full table definitions)

-- ============================================================
-- Data Migration: Integer → BigInteger IDs
-- ============================================================

-- Create new bigserial columns
ALTER TABLE handbook.book
    ADD COLUMN new_id BIGSERIAL PRIMARY KEY;

ALTER TABLE handbook.chapter
    ADD COLUMN new_id BIGSERIAL PRIMARY KEY;

ALTER TABLE handbook.section
    ADD COLUMN new_id BIGSERIAL PRIMARY KEY;

ALTER TABLE handbook.paragraph_chunk
    ADD COLUMN new_id BIGSERIAL PRIMARY KEY;

-- Update foreign keys to reference new_id
-- (This requires careful data preservation - omitted for brevity)

-- Drop old id columns after verification
-- ALTER TABLE handbook.book DROP COLUMN id;
-- ALTER TABLE handbook.book RENAME COLUMN new_id TO id;
```

---

## Operations Layer Updates

### File: `src/db/connection.py`

```python
def get_database_url() -> str:
    """Get database URL from env or default to SQLite for local dev."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    # Check if PostgreSQL DDL schema is being used
    pg_url = os.getenv("POSTGRES_URL")
    if pg_url:
        return f"{pg_url}/cherry_platform"  # Use cherry_platform DB from DDL

    # Fallback to SQLite
    sqlite_path = os.path.join(os.getcwd(), "local_dev.db")
    return f"sqlite:///{sqlite_path}"
```

---

## Implementation Checklist

- [ ] Update `src/db/models.py` with aligned models (rename tables + add columns)
- [ ] Create new models: `ParagraphConceptLink`, `EvidenceMetadata`, `ParagraphEmbedding`, `KnowledgeVerificationContributor`
- [ ] Run migration SQL to rename/move tables to `handbook.*` schema
- [ ] Add missing columns via ALTER TABLE
- [ ] Update `src/db/operations.py` imports to use new model names
- [ ] Add operations for new tables (concept links, embeddings, metadata)
- [ ] Update `run_pipeline.py` to populate new fields (paragraph_hash, simhash64, embeddings, etc.)
- [ ] Test paragraph deduplication using paragraph_hash + simhash64
- [ ] Test embedding generation and storage in `handbook.paragraph_embedding`
- [ ] Verify foreign key constraints cascade correctly

---

## FR Coverage Map

| FR | Description | Table(s) | Status |
|----|-------------|----------|--------|
| FR-3.2 | Ontology Extraction & Concept Discovery | `paragraph_concept_link`, `idea_group` | 🟡 Ready to implement |
| FR-3.3 | Evidence Collection & Study Sessions | `book`, `paragraph_chunk`, `knowledge_verification_contributor` | 🟡 Ready to implement |
| FR-7.2 | Curated Text Management | `book`, `chapter`, `section`, `paragraph_chunk` | 🟡 Ready to implement |
| FR-9.1 | Vector Storage for Deduplication | `paragraph_embedding` | 🟡 Ready to implement |
| FR-2.3 | Content Value Assessment | `evidence_metadata` | 🟡 Ready to implement |

---

## Next Steps

1. **Apply this alignment** to `text_extract_ideas` package
2. **Create Notion → PostgreSQL sync service** for Epic 1
3. **Write pseudo-code** for remaining Epic 1-3 pipelines
4. **Implement embedding generation** in pipeline workflow
