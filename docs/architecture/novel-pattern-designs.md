# Novel Pattern Designs

### Novel Pattern 1: Two-Layer Knowledge Architecture

**Purpose:** Separates the stable, normalized concept ontology (GraphDB) from the high-volume, source-attached evidence text (Postgres). Enables clean graph traversal without polluting the concept layer with raw paragraphs.

**Core Challenge:** Knowledge from different sources describes the same concept with different words. Without normalization, the graph fragments into thousands of near-duplicate concept nodes.

**Solution:**

- Evidence Layer (Postgres): Stores raw paragraph text with an `extracted_concept` field — a normalized noun phrase (e.g., `"Retrieval-Augmented Generation"`)
- Concept Layer (GraphDB): Stores only concept metadata and typed relations. No evidence text.
- Linkage: Loose coupling via the `extracted_concept` string field (no foreign key). Writer Agent queries GraphDB for concept, then queries Postgres `WHERE extracted_concept = 'RAG'`.

**Component Responsibilities:**

| Component              | Responsibility                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `concept_extractor.py` | Claude extracts one normalized noun phrase per paragraph                                   |
| `concept_matcher.py`   | GraphDB semantic similarity → if match (≥0.90): use existing name; if new: create concept  |
| `graph_updater.py`     | Create/update concept nodes in GraphDB; maintain `evidence_count`                          |
| `graph_query.py`       | Two-step query: GraphDB (concept + relations) → Postgres (evidence by `extracted_concept`) |

**Data Flow:**

```
Document
  → document_chunker.py (paragraph text)
  → paragraph_chunks table (stored)
  → concept_extractor.py (Claude → "Retrieval-Augmented Generation")
  → concept_matcher.py (GraphDB: find_similar_concepts("RAG", threshold=0.90))
    ├── Match found → update extracted_concept to canonical name
    └── No match → create new concept node in GraphDB
  → paragraph_chunks.extracted_concept = "Retrieval-Augmented Generation"
```

**Writer Agent Query Pattern:**

```python
# Step 1: GraphDB for concept + all typed relations
concept = graph_db.load_concept("Retrieval-Augmented Generation")
relations = graph_db.get_relations(concept.concept_id)
# returns: {prerequisites: [...], related: [...], subtopics: [...], extends: [...], contradicts: [...]}

# Step 2: Postgres for evidence paragraphs (via extracted_concept field)
evidence = postgres.query(
    """SELECT ep.*, em.extract_type, em.keywords, em.entities
       FROM paragraph_chunks ep
       LEFT JOIN evidence_metadata em ON em.evidence_paragraph_id = ep.id
       WHERE ep.extracted_concept = %s
       ORDER BY ep.importance_score DESC""",
    [concept.concept_name]
)

# Step 3: Claude synthesizes
page = page_synthesizer.generate(concept, relations, evidence)
```

**Affects Epics:** Epic 1 (database setup), Epic 3 (ingestion pipeline), Epic 4 (Writer Agent)

---

### Novel Pattern 2: Notion as Primary Workspace

**Purpose:** Knowledge Team uses Notion as their native review environment. The system treats Notion as source of truth for Newly Discovered content — no custom backend review UI needed.

**Core Challenge:** Building a custom review UI would double development scope. The team already works in Notion daily.

**Solution:** News ingestion pipeline writes directly to Notion. Postgres gets a daily one-way backup for analytics, historical record, and data independence.

**Critical Rules (agents MUST follow):**

- Notion is always source of truth for Newly Discovered content
- Postgres `notion_news_backup` is read-only analytics — **never write to Postgres expecting it to update Notion**
- Data flow is ONE-WAY: Notion → Postgres (never reverse)
- Weekly publish reads from Notion (not Postgres) to get latest approved status

**Data Flow:**

```
News ingestion + dedup + AI scoring 1-5
  → notion-client.ts → Notion DB (primary)
        ↓
  Knowledge Team review (Wednesday weekly)
  - Validate summaries
  - Confirm/correct scores
  - Map to ontology (LLM-assisted)
  - Status: Pending → Approved | Rejected
        ↓
  notion-backup.ts (cron: daily 00:00 UTC)
  → notion_news_backup table (Postgres)  ← ONE-WAY ONLY
        ↓
  weekly-publish.ts (cron: Sunday 00:00 UTC)
  → Query Notion for status="Approved" since last publish
  → format-dispatcher.ts → category-specific markdown
  → github-committer.ts → atomic commit to main
  → GitHub Actions → Next.js webapp deployment
```

**Notion DB Schema (properties per page):**

```
Title         (text)
Summary       (text)
Score         (number 1-5)
Category      (select: Model Updates | Frameworks | Productivity Tools | Business Cases | How People Use AI)
Source        (text)
SourceURL     (url)
Tags          (multi-select)
ReviewStatus  (select: Pending | In Review | Approved | Rejected)
Reviewer      (person)
PublishedDate (date — set by bot after GitHub commit)
```

**Affects Epics:** Epic 1 (Notion integration setup), Epic 2 (full Newly Discovered pipeline)

---

### Novel Pattern 3: Writer Agent Four-Section Synthesis

**Purpose:** Writer Agent generates Concept Pages with a consistent four-section format (Overview → Cherries → Related Concepts → Progressive References) with MECE organization throughout. All claims trace to ingested source material — no hallucinations.

**Core Challenge:** AI synthesis without guardrails produces inconsistent structure and hallucinated claims. Multiple AI agents must produce structurally identical pages.

**Component Responsibilities:**

| Component                 | Responsibility                                                                   |
| ------------------------- | -------------------------------------------------------------------------------- |
| `graph_query.py`          | Load concept + all relations + evidence; return `ConceptQueryResult` dataclass   |
| `page_synthesizer.py`     | Claude 3.5 Sonnet (200K context); structured output → Markdown                   |
| `synthesis_prompts.py`    | Prompt templates; includes no-hallucination rule                                 |
| `patchnote_aggregator.py` | Prepend change entry to `patchnote.md`; categorize as New/Major/Minor/Correction |

**No-Hallucination Rule (in synthesis prompt):**

```
CRITICAL: Only state facts that are directly supported by the provided evidence paragraphs.
For every claim, cite the source. Format: "[excerpt]" — [Source Title] ([paraphrase|direct|figure])
If the evidence does not support a claim, omit it.
```

**Output Format (Markdown with YAML frontmatter):**

```markdown
---
title: 'Retrieval-Augmented Generation'
date: 2025-01-01
last_updated: 2025-01-01
category: basics
tags: [rag, embeddings, vector-search]
contributors: [github_username1, github_username2]
---

# Retrieval-Augmented Generation

## 1. Overview

## 2. Cherries

## 3. Related Concepts (Co-occurring) / Subtopics (Child Concepts) / Prerequisite Concepts

## 4. Progressive References (MECE Learning Path)

📚 Start Here → 📖 Next → 🎓 Deep Dive → 💡 Practical Implementation
```

**Affects Epics:** Epic 4 (Writer Agent synthesis, image generation, publication)

---
