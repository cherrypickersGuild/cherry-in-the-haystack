# Epic 1 + 2 Team Integration Plan

**Project:** cherry-in-the-haystack
**Epic:** Discover Curated Content + Learn Structured Concepts
**Start Date:** 2026-04-05
**Target Duration:** 2 weeks (10 business days)
**Team Size:** 4 members

---

## 👥 Team Composition

| Role | Name | Skills | Primary Responsibilities |
|------|------|--------|-------------------------|
| **Tech Lead / Architect** | Hankeol | System design, TS, Python, GraphDB, Neptune | Architecture, API contracts, orchestration, coordination |
| **ETL Pipeline Builder** | _ | Data engineering, Python, Postgres | PDF extraction, evidence ingestion, chunking, embeddings, ETL pipelines |
| **AI Engineer (Agents)** | _ | Python, LLMs, LangChain, Anthropic/Claude API | Writer Agent, ontology extraction, concept matching, prompt engineering |
| **Web Developer** | _ | TypeScript, Next.js, NestJS, API routes | Frontend integration, API endpoints, TypeScript orchestration layer |

---

## 🎯 Epic Overview

### Epic 1: Discover Curated Content (Universal)
- **Goal:** Build content pipeline for weekly digest (one version for all users)
- **FRs covered:** FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-2.3, FR-5.1, FR-7.1, FR-9.1
- **Stories:**
  - Story 1.1: Status Check — Audit existing code, DB, infrastructure
  - Story 1.2: Daily Publication Pipeline — Notion → Postgres → GitHub
  - Story 1.3: Discover & Configure Additional Source — Source configuration UI

### Epic 2: Learn Structured Concepts (Universal)
- **Goal:** Build knowledge graph + Writer Agent for concept pages
- **FRs covered:** FR-3.1, FR-3.2, FR-3.3, FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-7.2, FR-8.1
- **Stories:**
  - Story 2.1: KG Status Check — Audit GraphDB, evidence layer, ontology extraction
  - Story 2.2: Pipeline Integration — Unified evidence → ontology → writer agent pipeline

---

## 🏗️ Architecture Overview

### Technology Stack (Per ADR-006)
- **TypeScript:** Web backend, cron job scripts, HTTP, Notion/GitHub API calls, job orchestration
- **Python:** LLM calls, PDF parsing, GraphDB queries, vector operations
- **PostgreSQL 16 + pgvector:** Evidence layer, embeddings (except ChromaDB for ontology)
- **AWS Neptune:** GraphDB for Concept layer (production)
- **ChromaDB:** Vector store for ontology package (temporary, may migrate to pgvector)

### Communication Architecture
```
TypeScript (Orchestrator)
    │
    ├── Python API (HTTP or stdio)
    │   ├── ETL Pipeline (PDF → Chunks → Embeddings)
    │   ├── AI Agent (Writer Agent, Ontology Extraction)
    │   └── GraphDB Client (SPARQL queries)
    │
    └── PostgreSQL (pgvector, Evidence layer, Content layer)
```

### Key ADR References
- **ADR-001:** GraphDB over Neo4j for Concept Layer
- **ADR-002:** Notion as Source of Truth (Postgres is one-way backup)
- **ADR-003:** pgvector over standalone vector database
- **ADR-004:** Next.js Webapp (content layer)
- **ADR-005:** Cron over Airflow for pipeline scheduling
- **ADR-006:** TypeScript for orchestration; Python for LLM/PDF/GraphDB
- **ADR-007:** Loose coupling via `extracted_concept` string field
- **ADR-008:** Tailscale for Infrastructure Access

---

## 📋 API Contract (CRITICAL — Must Define Before Implementation)

### Python ↔ TypeScript Communication Protocol

**Decision:** HTTP REST API with JSON payloads

#### Option A: HTTP API (Recommended)
```
┌─────────────────────────────────────────────────────────────┐
│                    Python FastAPI Server                     │
│  http://localhost:8000                                            │
│                                                                     │
│  POST /api/v1/pdf/extract                                      │
│  POST /api/v1/pdf/chunk                                         │
│  POST /api/v1/embeddings/generate                                │
│  POST /api/v1/ontology/extract                                 │
│  POST /api/v1/ontology/update                                   │
│  POST /api/v1/writer/generate                                   │
│  GET  /api/v1/health                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP (fetch/axios)
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Orchestrator                    │
│  packages/pipeline/src/jobs/* (node-cron jobs)               │
└─────────────────────────────────────────────────────────────┘
```

#### API Endpoints Specification

**Base URL:** `http://localhost:8000/api/v1`

##### 1. PDF Extraction (ETL Pipeline Builder)
```
POST /pdf/extract
Request:
{
  "pdf_url": "https://example.com/paper.pdf",
  "source_metadata": {
    "title": "AI Engineering Paper",
    "author": "John Doe",
    "publication_date": "2024-01-15"
  }
}
Response:
{
  "job_id": "uuid",
  "status": "processing",
  "estimated_time_minutes": 5
}
```

##### 2. Chunk & Store (ETL Pipeline Builder)
```
POST /pdf/chunk
Request:
{
  "pdf_path": "/data/papers/ai-engineering.pdf",
  "chunking_strategy": "hybrid_llm"  // or "toc_based"
}
Response:
{
  "job_id": "uuid",
  "chunks_created": 234,
  "chunks_stored": 234,
  "paragraph_chunks_table": "handbook.paragraph_chunk"
}
```

##### 3. Generate Embeddings (ETL Pipeline Builder)
```
POST /embeddings/generate
Request:
{
  "batch_id": "uuid",
  "table": "handbook.paragraph_chunk",
  "batch_size": 100,
  "model": "text-embedding-3-small"
}
Response:
{
  "embeddings_generated": 234,
  "vector_table": "handbook.paragraph_embedding"
}
```

##### 4. Extract Ontology (AI Engineer)
```
POST /ontology/extract
Request:
{
  "source": "evidence",  // or "article"
  "content": "Full text or article ID",
  "extraction_depth": 2,
  "min_confidence": 0.7
}
Response:
{
  "concepts_found": 15,
  "concepts": [
    {
      "name": "Transformer Architecture",
      "type": "concept",
      "confidence": 0.92,
      "properties": { "domain": "AI", "importance": "high" }
    }
  ]
}
```

##### 5. Update Ontology (AI Engineer)
```
POST /ontology/update
Request:
{
  "concepts": [...],
  "action": "add",  // or "update", "remove"
  "graphdb_repo": "cherry_ontology"
}
Response:
  {
  "concepts_updated": 15,
  "graphdb_status": "success"
}
```

##### 6. Generate Concept Page (AI Engineer)
```
POST /writer/generate
Request:
{
  "concept_slug": "transformer-architecture",
  "evidence_sources": ["paragraph_chunk", "article_evidence"],
  "generation_mode": "extend",  // or "replace"
}
Response:
{
  "job_id": "uuid",
  "status": "generating",
  "estimated_time_minutes": 3,
  "output_format": "markdown"
}
```

##### 7. Health Check
```
GET /health
Response:
{
  "status": "healthy",
  "python_version": "3.12",
  "dependencies": {
    "graphdb": "connected",
    "postgres": "connected",
    "anthropic_api": "configured"
  }
}
```

---

## 📅 10-Day Sprint Plan

### Day 1: Setup, Briefing, Kickoff

**All Team Members:**
- [ ] Read Epic 1 + 2 briefing documents (sent 1 day before)
- [ ] Attend kickoff meeting (90 min)
- [ ] Set up development environment
- [ ] Clone repo, install dependencies
- [ ] Review personal task list

**Tech Lead:**
- [ ] Create pre-integration backup tag
- [ ] Create integration branch: `epic-1-2-integration`
- [ ] Set up project tracker (GitHub Projects/Issues)
- [ ] Set up communication channel (Slack/Discord)
- [ ] Create API contract document (this section)
- [ ] Schedule daily standups (15 min, 9 AM daily)

**Deliverable:** Team ready, environments configured

---

### Day 2-3: Discovery & Architecture (Parallel Work)

**All Team Members:**
- [ ] Review existing code in `dev/packages/`
- [ ] Review feature branches (feat/pdf-extractor-v2, feat/pdf-knowledge-extractor, feature/ontology)
- [ ] Document findings in shared doc

**ETL Pipeline Builder:**
- [ ] Run `dev/packages/pdf_knowledge_extractor/` locally
- [ ] Test PDF extraction with sample PDF
- [ ] Understand chunking logic
- [ ] Document dependencies (requirements.txt, .env)
- [ ] Identify what needs to be exposed as API

**AI Engineer:**
- [ ] Review `dev/packages/ontology/` package
- [ ] Test GraphDB connection locally
- [ ] Understand ontology extraction logic
- [ ] Review Writer Agent requirements
- [ ] Document prompt templates, LLM API usage

**Web Dev:**
- [ ] Review current apps/api and apps/web structure
- [ ] Review existing DDL (docs/architecture/ddl-v1.0.sql)
- [ ] Understand NestJS structure
- [ ] Review package.json dependencies

**Tech Lead:**
- [ ] Review all team findings
- [ ] Create detailed architecture diagram
- [ ] Define Python↔TS API contract (finalize with team sign-off)
- [ ] Set up local GraphDB for testing (Docker)
- [ ] Set up PostgreSQL with pgvector extension
- [ ] Document integration points

**Deliverable:** Architecture finalized, API contract signed off

---

### Day 4-6: Implementation (Parallel Work)

**ETL Pipeline Builder:**
- [ ] Create FastAPI server skeleton
- [ ] Implement `/pdf/extract` endpoint
- [ ] Implement `/pdf/chunk` endpoint
- [ ] Implement `/embeddings/generate` endpoint
- [ ] Add error handling and logging
- [ ] Write unit tests for each endpoint
- [ ] Test with sample PDF end-to-end

**AI Engineer:**
- [ ] Create FastAPI server skeleton (or extend ETL's)
- [ ] Implement `/ontology/extract` endpoint
- [ ] Implement `/ontology/update` endpoint
- [ ] Implement `/writer/generate` endpoint
- [ ] Add Anthropic API integration
- [ ] Test GraphDB queries
- [ ] Test Writer Agent with sample concept

**Web Dev:**
- [ ] Create TypeScript HTTP client for Python API
- [ ] Implement Python execution layer in `packages/pipeline/src/integrations/`
- [ ] Create orchestrator jobs in `packages/pipeline/src/jobs/`:
    - `pdf-ingestion.ts` - calls Python PDF extraction
    - `embedding-build.ts` - calls Python embedding generation
- [ ] Add error handling and retry logic
- [ ] Implement pipeline_runs table logging
- [ ] Add Slack/email alerts on failure

**Tech Lead:**
- [ ] Review and approve API implementations
- [ ] Set up AWS Neptune (or local GraphDB for development)
- [ ] Import ontology to Neptune
- [ ] Create database migration scripts for handbook schema
- [ ] Coordinate integration testing
- [ ] Handle blockers and dependencies

**Deliverable:** Python APIs implemented, TS orchestration implemented

---

### Day 7-8: Integration & Testing

**All Team Members:**
- [ ] End-to-end testing: PDF → Chunks → Embeddings → GraphDB → Concept Page
- [ ] Test Python↔TS communication
- [ ] Performance testing
- [ ] Fix integration bugs
- [ ] Document any API changes

**ETL Pipeline Builder:**
- [ ] Test with various PDF types
- [ ] Validate chunking quality
- [ ] Verify embeddings stored correctly in pgvector

**AI Engineer:**
- [ ] Test ontology extraction with sample content
- [ ] Verify GraphDB writes
- [ ] Test Writer Agent output quality
- [ ] Iterate on prompts if needed

**Web Dev:**
- [ ] Test orchestrator jobs
- [ ] Verify pipeline_runs table logging
- [ ] Test Slack/email alerts
- [ ] Monitor for memory leaks in TS→Python calls

**Tech Lead:**
- [ ] Run end-to-end pipeline tests
- [ ] Validate all acceptance criteria for Epic 1 + 2
- [ ] Performance profiling
- [ ] Handle critical issues

**Deliverable:** Integrated pipeline working end-to-end

---

### Day 9: Buffer & Documentation

**All Team Members:**
- [ ] Fix remaining issues
- [ ] Write documentation
- [ ] Create runbooks

**ETL Pipeline Builder:**
- [ ] Document PDF ingestion pipeline
- [ ] Document chunking strategies
- [ ] Create troubleshooting guide

**AI Engineer:**
- [ ] Document ontology extraction process
- [ ] Document Writer Agent prompts
- [ ] Create GraphDB query examples

**Web Dev:**
- [ ] Document Python↔TS integration
- [ ] Document orchestrator job schedules
- [ ] Create deployment guide

**Tech Lead:**
- [ ] Create Epic 1 + 2 completion report
- [ ] Document architecture decisions
- [ ] Create rollback procedures
- [ ] Prepare demo/proof-of-concept

**Deliverable:** Documentation complete, ready for demo

---

### Day 10: Final Validation & Deployment Prep

**All Team Members:**
- [ ] Final testing
- [ ] Bug fixes
- [ ] Demo preparation
- [ ] Retrospective

**Tech Lead:**
- [ ] Validate all acceptance criteria met
- [ ] Run final regression tests
- [ ] Create deployment checklist
- [ ] Lead retrospective

**Deliverable:** Epic 1 + 2 complete, ready for next phase

---

## 🗂️ File Organization

### Python Packages (Existing in `dev/packages/`)
```
dev/packages/
├── ontology/                    # AI Engineer
│   ├── src/
│   │   ├── storage/
│   │   ├── pipeline/
│   │   └── utils/
│   ├── data/                     # GraphDB .ttl files
│   └── db/                       # GraphDB data
├── pdf_knowledge_extractor/     # ETL Pipeline Builder
│   ├── src/
│   ├── run_pipeline.py
│   └── run_chapters.py
└── (to be organized)
```

### TypeScript Pipeline (Orchestration)
```
packages/pipeline/
├── src/
│   ├── jobs/                    # Web Dev + Tech Lead
│   │   ├── status-check.ts
│   │   ├── pdf-ingestion.ts
│   │   ├── embedding-build.ts
│   │   ├── ontology-extraction.ts
│   │   ├── writer-agent.ts
│   │   └── daily-publish.ts
│   ├── integrations/            # Web Dev
│   │   ├── python-client.ts    # HTTP client to Python API
│   │   ├── graphdb-client.ts    # Direct GraphDB (if needed)
│   │   └── python-executor.ts   # Process spawning alternative
│   └── utils/
└── api/                         # Optional: Python API server
```

### Database Schema
```
PostgreSQL:
├── core/                        # Users, run logs, prompt templates
├── handbook/                    # Books, chapters, paragraph chunks, embeddings
├── content/                     # Articles, sources, entities
├── concept/                     # Concept pages, changelogs
└── snapshot/                    # Pre-built views, statistics

Neptune (GraphDB):
└── Ontology:
    ├── Concept nodes
    ├── Evidence nodes
    └── Relationships (prerequisite, related, etc.)
```

---

## 🔄 Daily Standup Format (15 minutes)

**Time:** 9:00 AM daily
**Channel:** Slack/Discord

**Format:**
1. **Yesterday:** What I completed, what blocked me
2. **Today:** What I plan to work on
3. **Blockers:** What I need from others

**Example:**
```
ETL Pipeline Builder:
✅ Implemented /pdf/extract endpoint
✅ Tested with sample PDF
→ Today: Implement /pdf/chunk endpoint
⚠️ Need: API contract confirmation from Tech Lead

AI Engineer:
✅ Reviewed ontology package
→ Today: Start FastAPI server setup
⚠️ Need: GraphDB connection details from Tech Lead

Web Dev:
✅ Created Python HTTP client skeleton
→ Today: Implement orchestrator job for pdf-ingestion
⚠️ Need: Python API base URL from team

Tech Lead:
→ Today: Set up local GraphDB, create migration scripts
⚠️️ Need: API contract sign-off from all
```

---

## ⚠️ Risk Management

### Technical Risks

| Risk | Owner | Mitigation |
|------|-------|------------|
| Python↔TS API contract changes | All | Sign-off contract before Day 4, document all changes |
| GraphDB connection issues | AI Engineer + Tech Lead | Test GraphDB early, have local fallback |
| PDF extraction edge cases | ETL Pipeline Builder | Test with various PDFs, document limitations |
| LLM API rate limits | AI Engineer | Implement batching, error handling, retry logic |
| Memory leaks in TS→Python calls | Web Dev | Monitor memory, use connection pooling |
| Migration conflicts | SQL Dev + Tech Lead | Incremental migrations, test on backup first |

### Coordination Risks

| Risk | Mitigation |
|------|------------|
| API contract misunderstandings | Document in OpenAPI/Swagger, get sign-off |
| Integration testing delays | Daily standup, shared testing environment |
| Rollback confusion | Clear rollback procedures, only Tech Lead can trigger |
| Environment setup issues | Document setup steps, share troubleshooting guides |

---

## 🚀 Rollback Procedures

### Level 1: Minor Issue (Keep Integration Work)
```bash
# Undo last commit, keep changes
git reset --soft HEAD~1
# Fix issues, re-commit
```

### Level 2: Moderate Issue (Reset to Integration Start)
```bash
# Reset to backup tag, keep files
git reset pre-epic-1-2-integration-*
# Review and fix
```

### Level 3: Major Issue (Full Abandon)
```bash
# Return to main, keep integration branch as reference
git checkout main
git branch -D epic-1-2-integration

# Or full reset (loses integration work)
git checkout main
git reset --hard pre-epic-1-2-integration-*
```

---

## 📊 Success Criteria

### Epic 1 Success Criteria
- [ ] Status check script runs and generates report
- [ ] Daily publication pipeline syncs Notion → Postgres → GitHub
- [ ] Source configuration allows adding/editing content sources
- [ ] All tests pass
- [ ] Documentation complete

### Epic 2 Success Criteria
- [ ] KG status check script runs and generates report
- [ ] Evidence ingestion pipeline processes PDFs → chunks → embeddings
- [ ] Ontology extraction discovers and adds new concepts
- [ ] Writer Agent generates concept pages from evidence
- [ ] Pipeline runs on schedule (or manual trigger)
- [ ] Failures trigger alerts (Slack/email)
- [ ] All tests pass
- [ ] Documentation complete

---

## 📝 Deliverables

### By Tech Lead
- [ ] Architecture decision records (if any new)
- [ ] API contract specification (OpenAPI/Swagger)
- [ ] Integration test report
- [ ] Epic 1 + 2 completion report
- [ ] Deployment checklist

### By ETL Pipeline Builder
- [ ] PDF extraction API documentation
- [ ] Chunking strategy documentation
- [ ] Embedding generation documentation
- [ ] Troubleshooting guide
- [ ] Unit tests for ETL endpoints

### By AI Engineer
- [ ] Ontology extraction documentation
- [ ] GraphDB query examples
- [ ] Writer Agent prompt documentation
- [ ] Concept page generation examples
- [ ] Unit tests for AI endpoints

### By Web Dev
- [ ] Python↔TS integration guide
- [ ] Orchestrator job documentation
- [ ] API client usage examples
- [ ] Error handling documentation
- [ ] Deployment guide

---

## 📞 Communication

- **Daily Standup:** 9:00 AM, 15 minutes
- **Communication Channel:** #epic-1-2-integration
- **Issue Tracking:** GitHub Issues tagged with epic-1 or epic-2
- **Documentation:** Shared in `docs/team/` or Google Doc

---

## 🎯 Next Steps (This Week)

### Immediate (Before Day 1)
- [ ] **Tech Lead:** Create backup tag, integration branch
- [ ] **Tech Lead:** Write briefing documents
- [ ] **All:** Schedule kickoff meeting
- [ ] **All:** Set up development environments

### Day 1: Kickoff
- [ ] 90-minute team meeting
- [ ] Review briefings, ask questions
- [ ] Assign initial tasks
- [ ] Set up daily standup

### Day 2-3: Discovery
- [ ] Everyone: Review existing code
- [ ] **Tech Lead:** Finalize API contract, get sign-off
- [ ] **All:** Document findings

---

## 📎 Notes

- **API Contract is CRITICAL** — Do not start implementation until API contract is signed off by all
- **Git Safety:** Only Tech Lead can merge to main or trigger rollbacks
- **Testing:** Create shared testing environment for integration testing
- **Documentation:** Document as you go, don't leave to end
- **Coordination:** Daily standups are mandatory, blockers called out immediately

---

**Last Updated:** 2026-04-05
**Version:** 1.0
**Status:** Ready for kickoff
