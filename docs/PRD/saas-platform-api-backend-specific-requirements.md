# SaaS Platform + API Backend Specific Requirements

## MVP Architecture: Full-Stack Web Application

Cherry is now a **full-stack SaaS platform** with user management, personalization, and enterprise features. This architecture shift provides:

- Dynamic, personalized content delivery
- User authentication and authorization
- Custom preferences and adaptive knowledge base
- Enterprise content creation tools (Newsletter Studio)
- Scalable infrastructure for growth

## System Architecture

**Newly Discovered Content Pipeline:**

```
Content Ingestion Pipeline + Deduplication
  ↓
AI Scoring (1-5) + Auto-assignment to Knowledge Team members
  ↓
Knowledge Team Review (Notion - Wednesday weekly)
  - Validate summaries
  - Confirm scores
  - LLM-assisted ontology graph mapping
  ↓
Graph DB Link (concept-to-news mappings)
  ↓
Community Content Repository (Database)
  ↓
[Personalization Layer]
  ↓
Web Application Dynamic Delivery
  - Free users: All community content
  - Paid users: Filtered by preferences (hide categories, custom scoring)
```

**Basics/Advanced Content Pipeline:**

```
Curated Text Sources (PDFs, books, websites, study materials)
  ↓
Evidence Layer Storage (Graph DB)
  ↓
Knowledge Team Study Sessions (Wednesday - evidence review)
  ↓
Ontology Extraction (new concept noun phrases detected monthly)
  ↓
Knowledge Team Concept Review (2nd Saturday monthly)
  - Evaluate new concept candidates (word count metrics)
  - Discuss and finalize TOC updates
  - Decide concept promotion (Advanced → Basics)
  ↓
Writer Agent Page Generation (New Four-Section Format)
  - Load concept + connected concepts + relationships
  - Collect mapped evidence sources
  - Generate: Overview → Cherries → Child Concepts → Progressive References (MECE)
  - Compose page (cite/paraphrase evidence)
  ↓
Community Content Repository (Database)
  ↓
[User-Controlled Custom Knowledge Base]
  - Paid users can add custom topics with reference articles
  - User commands Writer Agent to regenerate pages with custom evidence
  ↓
Web Application Dynamic Delivery
  - Personalized knowledge base per user
```

**Newsletter Studio Pipeline (Enterprise):**

```
User Configures Agent
  - Tone, structure, audience level, focus areas
  ↓
User Selects Sources
  - Community-curated sources
  - Private enterprise sources
  - Custom RSS feeds
  ↓
"Highly Rated News for This Week" Interface
  - Personalized to enterprise's sources
  - User picks supporting evidence items
  ↓
One-Click Draft Generation
  - Newsletter Agent synthesizes content
  - Output format: Markdown, Plain Text, HTML (user chooses)
  ↓
In-App Editing & Version History
  - Iterative refinement
  - A/B testing different angles
  - Previous drafts accessible
  ↓
Email Distribution
  - Send to email lists
  - Integration with email service providers
```

## Concept Page Structure (UI Design)

**Design Philosophy:** Four-section progressive learning structure with MECE organization throughout.

**Page Layout for Basics/Advanced Concepts (Applied to ALL users - Free & Paid):**

```
# [Concept Title]

# 1. Overview
**What is [Concept]?**
- 1-2 sentence definition
- Why this matters to engineers
- Context and practical relevance
- Real-world problem this solves

**When to use:**
- Situational guidance
- Use cases and anti-patterns

# 2. Cherries
MECE-structured key insights from ingested books and sources on this concept:

- **[Source Title A]** — [Distinct insight or framing this source provides]
- **[Source Title B]** — [Different angle or aspect not covered by A]
- **[Source Title C]** — [Further non-overlapping insight]

*(Each cherry is a valuable piece picked from the haystack of source material — non-overlapping, collectively exhaustive)*

# 3. Child Concepts / Co-occurring Concepts
These concepts are commonly used together or build upon [Concept]:

## Prerequisite Concepts
- **[Related Concept A]** — Brief description of relationship
  - Why it matters: [1-line explanation]
  - Link to concept page

- **[Related Concept B]** — Brief description of relationship
  - Why it matters: [1-line explanation]
  - Link to concept page

## Related Concepts (Co-occurring)
- **[Concept X]** — Often used together (e.g., RAG + Reranking)
- **[Concept Y]** — Alternative or complementary approach

## Subtopics (Child Concepts)
- **[Narrower Concept]** — Specific implementation or technique
- Links to detailed pages for each

## Extensions (Advanced)
- **[Advanced Concept]** — Building on this foundation
- Links to Advanced section

# 4. Progressive References (MECE Learning Path)

**Mutually Exclusive, Collectively Exhaustive reference organization:**

📚 **Start Here** (Beginner-Friendly Introduction)
1. **[Reference A: Title]**
   - What it covers: Broad, easy introduction to [Concept]
   - Format: Blog post / Tutorial / Book chapter
   - Reading time: ~20 minutes
   - Why start here: Best foundational overview
   - Link: [URL]

📖 **Next** (Builds on Previous)
2. **[Reference B: Title]**
   - What it covers: [Specific aspect NOT covered in Reference A]
   - Format: Documentation / Paper / Guide
   - Reading time: ~30 minutes
   - Why read this next: Adds [specific knowledge gap filled]
   - Link: [URL]

🎓 **Deep Dive** (Advanced Understanding)
3. **[Reference C: Title]**
   - What it covers: [Deeper technical details or advanced patterns]
   - Format: Research paper / Advanced tutorial
   - Reading time: ~45 minutes
   - Why read this: Complete understanding of [advanced aspect]
   - Link: [URL]

💡 **Practical Implementation** (Hands-On)
4. **[Reference D: Title]**
   - What it covers: Code examples, implementation patterns
   - Format: GitHub repo / Colab notebook / Tutorial
   - Why read this: See concept in action
   - Link: [URL]

---

**Contributors:** [Knowledge Team members who curated this concept]

[Optional: Interactive graph visualization showing this concept's position in knowledge graph]
```

**Key Design Principles:**

1. **Overview Section:**
   - Answers "What is this?" and "Why should I care?"
   - Provides immediate context and value proposition
   - Accessible to all skill levels

2. **Cherries Section:**
   - Shows what authoritative sources actually say — no AI invention
   - MECE: each entry covers a distinct aspect of the concept (Mutually Exclusive)
   - Together, entries give a complete picture of the concept across literature (Collectively Exhaustive)
   - Source attribution on every entry enforces the no-hallucination guarantee

3. **Child Concepts Section:**
   - Shows relationships from Graph DB ontology
   - Helps users navigate knowledge graph
   - Prerequisite → Related → Subtopics → Extensions hierarchy
   - Each relation type rendered only if exists (dynamic)

4. **Progressive References (MECE):**
   - **Mutually Exclusive:** Each reference covers unique aspects, minimal overlap
   - **Collectively Exhaustive:** Together, references provide complete understanding
   - **Progressive Difficulty:** Start easy, increase complexity
   - **Value Explanation:** Each reference explicitly states what unique value it adds
   - **Clear Sequencing:** Reading order optimized for learning efficiency

## Content Storage Architecture

**Database-Driven Content Management:**

- Community content stored in relational database (PostgreSQL)
- Graph database for concept ontology and relationships (Neo4j or compatible)
- Vector database for deduplication only (Milvus, ChromaDB, or Pinecone)
- Content Ingestion Pipeline codebase integrated with main application

**Content Database Schema:**

```
Tables:
- concepts: id, title, summary, section (basics/advanced), created_at, updated_at
- concept_relationships: id, from_concept_id, to_concept_id, relationship_type (prerequisite/related/subtopic/extends/contradicts)
- evidence: id, source, location, text, excerpt, comment, tags, created_at
- concept_evidence_links: concept_id, evidence_id
- references: id, concept_id, title, url, description, learning_order, reading_time, difficulty_level
- newly_discovered: id, category, title, summary, score, source, published_at, reviewed_at
- users: id, email, tier (free/paid/enterprise), preferences_json, created_at
- user_sources: user_id, source_url, source_type, active
- user_reading_history: user_id, content_id, content_type, read_at
- newsletters: id, user_id, config_json, draft, version, created_at, updated_at
```

**Parent-Child Concept Hierarchy:**

- **Parent:** High-level concept (stored as concept with no parent relationship)
- **Child:** Specific implementations (stored as concept with "subtopic" relationship to parent)
- Maximum 2 levels of depth to maintain clarity and navigation simplicity
- Navigation structure built dynamically from concept_relationships table

## Automation & Deployment Requirements

**Content Pipeline Automation:**

- **Content Ingestion:** Scheduled jobs (cron-based scheduler) pull from configured sources
- **AI Scoring & Review:** Triggered on new content ingestion
- **Knowledge Team Workflow:** Notion API integration for review process sync
- **Writer Agent Page Generation:** Triggered monthly after concept review OR on-demand for user custom topics
- **Database Updates:** Atomic transactions for all content updates

**Web Application Deployment:**

- **Backend API:** RESTful API (FastAPI, Express.js, or Django)
- **Frontend:** React/Vue.js single-page application
- **Hosting:** Cloud provider (AWS, GCP, Azure, or Vercel/Netlify for frontend)
- **CI/CD:** Automated testing and deployment pipeline
- **Database Migrations:** Version-controlled schema migrations
- **Monitoring:** Application performance monitoring (APM), error tracking, logging

**Deployment Strategy:**

- **Development → Staging → Production** pipeline
- **Zero-downtime deployments** with blue-green or rolling updates
- **Database backups:** Automated daily backups with point-in-time recovery
- **Rollback capability:** Quick revert to previous stable version

## Web Application Architecture

**Frontend (React/Vue.js SPA):**

**Core Features:**

- Dynamic content rendering based on user tier and preferences
- Table of contents with 2-level hierarchy
- Mobile-responsive design
- Syntax highlighting for code blocks
- Markdown rendering with embedded components

**User Interface Components:**

- Authentication pages (login, signup, password reset)
- User dashboard (personalized vs unpersonalized views)
- Navigation sidebar (Basics, Advanced, Newly Discovered)
- Content browsing with filters (free: view all, paid: custom filters)
- Newsletter Studio workspace (enterprise users)
- User settings and preference management
- Language selector (multi-language UI support)

**Design System:**

- Brand colors and logo
- Card layouts for "Newly Discovered" section
- Collapsible sections for accumulated news
- External link indicators
- Category badges/tags
- Dark mode support (Growth phase)
- Accessibility-first design (WCAG 2.1 AA)

**Navigation:**

- Three primary sections (Basics, Advanced, Newly Discovered)
- Category grouping within each section
- Breadcrumbs for orientation
- "Last updated" timestamps on pages
- Reading progress indicators (paid users)

**Backend API (RESTful):**

**API Endpoints:**

- `/api/auth/` - Authentication and authorization
- `/api/content/` - Content retrieval (basics, advanced, newly-discovered)
- `/api/users/` - User management and preferences
- `/api/personalization/` - Custom scoring, filters
- `/api/sources/` - User source management (paid tier)
- `/api/newsletter/` - Newsletter Studio operations (enterprise tier)
- `/api/knowledge-base/` - Custom topic management (paid tier)

**Technology Stack:**

- **Backend:** Next.js (Node.js) connected with FastAPI (Python) agent modules
- **Database:** PostgreSQL for relational data
- **Graph DB:** GraphDB for concept ontology
- **Vector DB:** pgvector for deduplication & vector search
- **Cache:** Redis for session management and performance
- **Queue:** Celery/Bull for background jobs (Writer Agent, email sending)
- **Authentication:** JWT tokens, OAuth providers (Google, GitHub)

## Hosting & Deployment

**Cloud Infrastructure:**

- **Provider:** AWS, GCP, Azure, or managed platform (Vercel, Render, Fly.io)
- **Domain:** Custom domain with SSL/TLS (Let's Encrypt or cloud provider)
- **CDN:** CloudFlare or cloud provider CDN for static assets
- **Auto-scaling:** Horizontal scaling based on traffic
- **Load Balancing:** Distribute traffic across multiple instances

**Performance:**

- **Target Page Load:** Under 2 seconds on 3G connection
- **API Response Time:** Under 300ms for p95
- **Database Query Optimization:** Indexed queries, connection pooling
- **CDN Caching:** Static assets cached at edge locations
- **Image Optimization:** WebP format, lazy loading, responsive images

**SEO Optimization:**

- Server-side rendering (SSR) or pre-rendering for SEO
- Sitemap generation for search engines
- Meta tags and Open Graph for social sharing
- Structured data (schema.org) for rich snippets
- Descriptive URLs (e.g., `/basics/rag/naive-rag` not `/page123`)

**Security:**

- HTTPS enforcement
- CORS configuration for API
- Rate limiting on public endpoints
- Input validation and sanitization
- SQL injection protection (parameterized queries)
- XSS protection (content sanitization)
- CSRF tokens for forms
- Secure password hashing (bcrypt/argon2)

## Content Seeding Strategy

**Initial Population:**

**Basics Section:**

1. Source curated content from:
   - O'Reilly books (PDF extraction)
   - Canonical blog posts and documentation
   - Academic papers and tutorials
2. AI extracts and normalizes paragraph-level key concepts
3. AI writes relations (links), checks the ontology on Graph DB for similar concepts, adds or merges
4. Writer Agent writes pages in **new four-section format** (Overview → Cherries → Child Concepts → Progressive References), based on TOC given by knowledge team
5. Human editing for clarity and structure
6. Store in database (concepts, references, evidence tables)

**Advanced Section:**

- Same process as Basics, but with deeper technical content

**Newly Discovered Section:**

- Seed with first month of Content Ingestion Pipeline curation
- 10+ entries per category from existing Notion database
- Backfill high-quality content from recent months
- Store in `newly_discovered` database table with category tags

## Browser & Platform Support

**Supported Browsers:**

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- Last 2 major versions
- No Internet Explorer support

**Mobile Support:**

- Responsive design
- Touch-friendly navigation
- Optimized for mobile reading experience

**Accessibility:**

- WCAG 2.1 AA compliance target
- Keyboard navigation
- Screen reader compatibility
- Semantic HTML structure
- Sufficient color contrast

---
