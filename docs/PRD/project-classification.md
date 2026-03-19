# Project Classification

**Technical Type:** SaaS Platform (Web Application + API Backend + User Management)
**Domain:** EdTech / Knowledge Management / B2B SaaS
**Complexity:** High (expanded from Medium due to personalization engine, user management, and enterprise features)

## Architecture Evolution

The product transforms from a personal curation tool into a **multi-tier SaaS platform** with community curation, personalization, and enterprise content creation:

**Foundation:** Content Ingestion Pipeline (Refactored from personal aggregation system)

- Event-driven data pipeline with simple scheduler
- LLM-powered categorization, ranking, summarization
- Integration with Notion review system and database storage

**New Architecture:** Cherry for AI Engineers SaaS Platform

```
[Community Content Pipeline - Foundation Layer]
Stage 1: Content Ingestion Pipeline
  ↓
Stage 2: Knowledge Team Review (Notion Review System)
  ↓
Stage 3: Knowledge Graph Building (Graph DB with Ontology + Evidence Layers)
  ↓
Stage 4: Writer Agent Synthesis (AI-generated pages from knowledge graph)
  ↓
Stage 5: Community Content Repository

[User Experience Layer - Personalization & Delivery]
Stage 6: User Management & Authentication (Free/Paid/Enterprise Tiers)
  ↓
Stage 7: Personalization Engine
  - Custom source preferences
  - Natural language scoring criteria
  - Content filtering
  - Reading history tracking
  ↓
Stage 8: Dynamic Web Application
  - Personalized content delivery
  - Adaptive knowledge base (user-controlled topics)
  - Custom Writer Agent regeneration with user evidence
  ↓
Stage 9: Newsletter Studio (Enterprise)
  - Agent configuration (tone, structure, audience)
  - Evidence selection from curated + custom sources
  - Draft generation with version history
  - Email distribution
```

**Key Technical Shifts:**

- **From:** Static Jupyter Book → **To:** Full-stack web application with database, auth, real-time UI
- **From:** GitHub Pages (static hosting) → **To:** Cloud-hosted SaaS platform
- **From:** No user data → **To:** User accounts, preferences, drafts, reading history, custom content

**Knowledge Infrastructure: Concept-Centric Graph Database**

A two-layer knowledge system optimized for stable concept ontology with dynamic evidence:

- **1. Concept Layer** (Stable, normalized)
  - Abstract ideas as unique noun-phrase nodes (e.g., "Evaluation-Driven Development")
  - Concepts reused across all sources for consistency
  - Relations between concepts: prerequisite, related, subtopic, extends, contradicts
  - Evidence NOT stored in concept nodes (only linked)
  - Each concept includes: title, summary, relations, sources

- **2. Evidence Layer** (High volume, source-attached)
  - Paragraphs/snippets with full source metadata
  - Types: paraphrase, direct quote, figure reference
  - Evidence can link to multiple concepts
  - Schema: evidence_id, source, location, text, excerpt, comment, tags, linked_concept

**Design Goals:**

- Clean concept graph (concepts only, no evidence nodes)
- Evidence previews embedded inside relation blocks
- Stable concept ontology + dynamic evidence accumulation

**Future Vision:** "GitHub for Personal Knowledge Management"

- Personal knowledge repositories
- Cross-user synchronization with AI assistance
- Collaborative knowledge graphs

---
