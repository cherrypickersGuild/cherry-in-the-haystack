# Executive Summary

cherry-in-the-haystack builds **Cherry for AI Engineers** through a two-layer knowledge architecture: Evidence Layer (PostgreSQL for source paragraphs in `paragraph_chunks` with `extracted_concept` linkage) + Concept Layer (GraphDB for normalized concept ontology). Three pipelines operate in parallel: (1) **Newly Discovered** — Python-based news ingestion (feedparser, newspaper3k) scores content → Notion serves as the primary Knowledge Team review workspace → daily Postgres backup → weekly publication; (2) **Basics/Advanced** — source documents chunk (PyMuPDF, unstructured) → concept extraction (langchain) and graph normalization (SPARQLWrapper) → Writer Agent synthesizes four-section handbook pages; (3) **Newsletter Studio** (future Phase 2, not in current epics).

**Technology Stack:**
- **Frontend:** Next.js/React (TypeScript) — kept for SEO and complex UIs
- **Web Backend:** NestJS (TypeScript) — main API backend
- **Python Service:** FastAPI — specialized service for AI/LLM, Celery tasks, data processing
- **Task Scheduling:** Celery + Redis — Python-native task queue
- **AI/LLM:** z.ai (Python SDK) — single provider for all LLM operations
- **Content:** NestJS serves content via REST API → Next.js consumes, calls FastAPI when needed for AI operations

**Key Principle:** TypeScript for web application (Next.js + NestJS). Python reserved for AI/LLM, data processing, and Celery tasks. NestJS calls FastAPI only when Python-specific operations are needed. The architecture prioritizes automation, cost tracking per LLM call, weekly update velocity, and zero-hallucination synthesis (all claims trace to evidence).

---
