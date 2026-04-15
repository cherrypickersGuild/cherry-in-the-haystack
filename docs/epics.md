---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories"]
inputDocuments: ["docs/PRD/index.md", "docs/PRD/functional-requirements.md", "docs/PRD/non-functional-requirements.md", "docs/architecture/index.md", "docs/architecture/data-architecture.md", "docs/architecture/deployment-architecture.md", "docs/architecture/security-architecture.md", "docs/ux-design-specification.md"]
currentEpic: All 7 epics completed
epicsCompleted: [1, 2, 3, 4, 5, 6, 7]
totalStories: 26
---

# cherry-in-the-haystack - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for cherry-in-the-haystack, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**FR-1.1: Multi-Source Content Collection**
- Automatically aggregate LLM-related content from diverse sources (Twitter, Discord, GitHub, papers, blogs, RSS feeds)
- Content Ingestion Pipeline pulls from at least 10 configured sources
- New content discovered within 24 hours of publication
- Source metadata preserved (URL, date, author, platform)
- Configurable source priorities and categories

**FR-1.2: Intelligent Deduplication**
- Identify and filter duplicate or redundant content before processing
- Content-level deduplication before scoring (exact matches, near-duplicates)
- Chunk-level deduplication for Basics/Advanced synthesis (paragraph similarity)
- 95%+ accuracy in identifying true duplicates
- Preserve original source for merged duplicates

**FR-2.1: AI-Powered Content Scoring**
- Automatically evaluate content relevance and quality on 1-5 scale
- AI agent scores content based on defined criteria (relevance, depth, novelty, practicality)
- Score 5 = top-tier content worthy of inclusion
- Scoring completes within 5 minutes of ingestion
- Pattern-based learning improves scoring accuracy over time

**FR-2.2: Knowledge Team Review Workflow**
- Structured weekly review and approval process managed by Knowledge Team in Notion
- Score-5 items auto-assigned to Knowledge Team members in Notion
- Team members can validate summaries, adjust scores, and request edits
- Weekly review cycle (Wednesday) with structured meeting
- LLM-assisted ontology graph mapping during review
- Status tracking: pending → in_review → finished
- Top 20 finished items (score 5) flow to newsletter generation
- Audit trail of all review decisions

**FR-2.3: Content Value Assessment**
- AI identifies unique, value-adding information vs repetitive noise
- Chunk-level (paragraph) analysis for novelty
- Comparison against vector database of existing content
- "Unique" flag for truly novel information
- Value score based on: novelty, depth, practical applicability, evidence quality

**FR-3.1: Graph Database Two-Layer Architecture**
- Concept-centric knowledge system with stable ontology and dynamic evidence
- **Concept Layer (Stable):** Store concepts as unique noun-phrase nodes only; Concepts must be reusable across all sources; Relation types: prerequisite, related, subtopic, extends, contradicts; Evidence NEVER stored in concept nodes; Concept schema: title, summary, relations, sources, contributors; Concepts must support dynamic relation block rendering in UI
- **Evidence Layer (High Volume):** Store paragraphs/snippets separately from concepts; Required metadata: source, location, text, excerpt, comment, tags, linked_concepts; Evidence types: paraphrase, direct quote, figure reference; Evidence can link to multiple concepts (many-to-many)
- **Performance:** Graph queries complete in under 500ms for writer agent; Support concurrent reads during page generation; Efficient traversal for concept → related concepts → evidence chains
- **Integration:** Coexists with Vector DB (used only for deduplication); Graph view shows concepts only (no evidence nodes cluttering visualization)

**FR-3.2: Ontology Extraction & Concept Discovery**
- Monthly extraction of new concept noun phrases from evidence layer
- Monthly batch job (2nd Saturday) extracts new concept candidates from evidence layer
- Word count and frequency metrics filter noise vs meaningful concepts
- LLM-assisted concept relationship detection
- Concept candidates presented to Knowledge Team for review
- Approved concepts added to Ontology Layer with initial relationships
- New concepts default to Advanced section (promotion to Basics based on sustained importance)

**FR-3.3: Evidence Collection & Study Sessions**
- Knowledge Team study sessions populate Evidence Layer with curated texts
- Wednesday study sessions review texts (books, papers, documentation)
- Reviewed texts stored in Evidence Layer with metadata (source, date, topic, quality)
- Text chunking for efficient storage and retrieval
- Evidence tagged with relevant concept associations
- Study session notes captured for context

**FR-4.1: MECE Knowledge Organization**
- Structure content into Mutually Exclusive, Collectively Exhaustive taxonomy
- 3 main sections: Basics, Advanced, Newly Discovered
- 2-level hierarchy: parent concepts → child implementations
- No concept should fit in multiple categories
- All LLM engineering topics covered (95% coverage target)
- Taxonomy evolves based on emerging topics

**FR-4.2: Writer Agent for Page Generation**
- AI agent generates Basics/Advanced pages from knowledge graph using structured schemas
- **Input:** Concept node from Ontology Layer (triggered monthly after concept review)
- **Step 1:** Query CONCEPT schema from Graph DB - Load target concept + connected concepts + relationships; Retrieve relation types (prerequisite, related, subtopic, extends, contradicts)
- **Step 2:** Query EVIDENCE schema to retrieve full evidence details - Full text, excerpts, source metadata, comment types
- **Step 3:** Generate page structure following Concept Page UI Design: Title and summary; Dynamic relation blocks (only non-empty sections); Evidence previews embedded in each relation item; Sources & Commentary section with reading order; Contributors list
- **Step 4:** Compose page content by: Citing evidence with proper attribution; Paraphrasing where appropriate; Maintaining evidence preview format; Including "why" explanations for each relation
- Generated pages follow style guide (clarity, examples, trade-offs)
- Flag conflicting evidence from multiple sources for Knowledge Team review
- Page generation completes within 10 minutes per concept
- Output: Markdown file conforming to Concept Page Structure

**FR-4.3: Concept Promotion Flow (Advanced → Basics)**
- Promote concepts from Advanced to Basics based on sustained importance
- New concepts default to Advanced section
- Metric-based evaluation tracks concept importance over time (mentions, usage, stability)
- Monthly Knowledge Team review (2nd Saturday) evaluates promotion candidates
- Promoted concepts move from Advanced → Basics with page updates
- Promotion decisions documented with rationale

**FR-4.4: Evolving Taxonomy Management**
- Continuously update content categories as LLM field evolves
- New categories can be added without restructuring
- Content can be reassigned when taxonomy changes
- Category deprecation with content migration plan
- "Newly Discovered" categories reviewed quarterly for relevance

**FR-5.1: Automated Publication Pipeline**
- Approved content automatically flows from Notion → Public site
- Weekly batch: Notion → Cherry app update (markdown files)
- Zero-downtime deployments
- Rollback capability for broken builds

**FR-5.2: Structured Content Display**
- Cherry renders content with professional layout and navigation
- 3-section navigation (Basics, Advanced, Newly Discovered)
- 2-level TOC with parent-child hierarchy
- Built-in search functionality
- Mobile-responsive design
- Syntax highlighting for code
- "Last updated" timestamps
- Breadcrumb navigation

**FR-6.1: URL Submission for Sources**
- Community submits URLs for Content Ingestion Pipeline to monitor
- Simple form/interface for URL submission
- Validation: URL format, domain reachability
- Queue for maintainer review
- Approved URLs added to Content Ingestion Pipeline source list
- Feedback to submitter (approved/rejected/reason)

**FR-7.1: Content Source Configuration**
- Manage which sources Content Ingestion Pipeline monitors for "Newly Discovered"
- Configuration file lists: source URL, category mapping, polling frequency
- Sources include: Twitter accounts, Discord channels, GitHub orgs, RSS feeds, blogs
- Per-source enable/disable toggle
- Source health monitoring (last successful pull, error rate)

**FR-7.2: Curated Text Management for Basics/Advanced**
- Manage library of curated sources (books, papers, canonical posts)
- Document registry: source metadata (title, author, URL, PDF, publication date)
- Extraction pipeline: PDF → text, web → markdown
- Version tracking for updated sources
- Source prioritization (canonical vs supplementary)

**FR-8.1: Content Correction & Updates**
- Fix errors, update outdated information, improve clarity
- Error reporting mechanism (GitHub issues)
- Fast-track corrections for critical errors
- "Last updated" dates show freshness
- Changelog for major page updates
- Deprecated content marked clearly with alternatives

**FR-9.1: Vector Storage for Deduplication**
- Store embeddings of all unique content chunks
- Embeddings generated for all approved content
- Vector database indexes: source, category, date, topic
- Similarity search: cosine similarity threshold for duplicates
- Efficient querying (under 100ms for similarity check)

**FR-10.1: User Registration & Login**
- Secure user account creation and authentication system
- Email/password registration with email verification
- OAuth login (Google, GitHub)
- Password reset flow
- JWT-based session management
- Secure password hashing (bcrypt/argon2)
- Account email change with verification

**FR-10.2: User Tier Management**
- Support Free, Paid, and Enterprise tiers with appropriate feature access
- Free tier: Access to all community content (no account required for read-only)
- Paid tier: Personalization, custom sources, adaptive KB
- Enterprise tier: Everything in Paid + Newsletter Studio
- Tier-based feature gating in UI and API
- Upgrade/downgrade flows with proration
- Billing integration (Stripe or similar)

**FR-10.3: User Profile Management**
- Users can manage their account settings and preferences
- Profile page: name, email, tier, join date
- Preference management (separate from personalization settings)
- Account deletion (GDPR compliance)
- Export user data (GDPR compliance)
- Reading history view (paid users)

**FR-11.1: Custom Source Management**
- Users can add private sources beyond community-curated content
- Add/remove custom source URLs (RSS, Twitter, blogs, etc.)
- Toggle which community sources to follow
- Source validation (reachable, valid format)
- Content Ingestion Pipeline ingests user's custom sources
- Content from custom sources only visible to that user
- Source management UI with active/inactive status

**FR-11.2: Natural Language Scoring Criteria (Paid Tier)**
- Users define scoring preferences in natural language, AI interprets into weights
- Input field for natural language criteria
- AI parses criteria and generates scoring weights
- Confirmation UI showing interpreted weights
- User can refine and iterate
- Scoring applies to feed ranking and content prioritization
- Default community scoring for users who don't customize

**FR-11.3: Content Filtering & Feed Personalization (Paid Tier)**
- Paid users personalize "Newly Discovered" through entity-level follows and category-level filtering
- **Entity Follow (Registry-level):** Follow or unfollow specific tracked entities; Assign per-entity weight; Articles mentioning followed entities are surfaced; unfollowed entities are excluded
- **Category Filtering:** Show/hide entire category groups; Assign per-category weight; Filters apply across all Newly Discovered category pages
- **Personalized Page Output:** Newly Discovered category pages show filtered + reranked article list; Ranking signal: user_article_state.impact_score; Community page shown as fallback
- Free users see full community-curated content; paid users see filtered/reranked view
- Easy toggle between "Community" and "For You" views

**FR-11.4: Adaptive Content Scoring**
- Apply user's custom scoring criteria to content ranking
- User-defined scoring weights applied to all content
- Re-ranking of "Newly Discovered" feed based on user criteria
- Score explanations: "This scored high because of your preference for X"
- A/B comparison: community score vs personal score

**FR-12.1: User-Controlled Topic Addition**
- Paid users can add custom topics with reference articles
- UI for adding new topics (not in community KB)
- Upload or link reference articles/evidence
- Topic name, category (Basics/Advanced), and description
- Evidence extraction from user-provided references
- Store in user-specific evidence layer linked to Graph DB
- User's custom topics visible only to them

**FR-12.2: Writer Agent Regeneration for Custom Topics**
- Users command Writer Agent to generate pages for their custom topics
- User clicks "Generate Page" for custom topic
- Writer Agent loads user's custom evidence
- Generates page in four-section format (Overview → Cherries → Child Concepts → Progressive References)
- Page saved in user's personal knowledge base
- Regeneration takes under 10 minutes
- User can iterate: add more evidence → regenerate

**FR-12.3: User Knowledge Base Management**
- Manage custom topics and personal knowledge base
- View all custom topics (list view)
- Edit/delete custom topics
- Add/remove/edit reference articles for topics
- Trigger regeneration after changes
- Export personal KB to markdown
- Distinction between community content and personal custom content

**FR-13.1: Multi-Language UI**
- Platform interface available in multiple languages for global accessibility
- **Initial Languages:** English (primary), Korean
- Language selector in user settings and header
- All UI elements translated: navigation, buttons, labels, form fields, error messages
- User language preference saved (logged-in users)
- Browser language detection for non-logged-in users (fallback to English)
- RTL (Right-to-Left) layout support for future languages
- Translation files: JSON-based i18n format
- Easy addition of new languages

**FR-13.2: Content Language Handling**
- Clear distinction between UI language and content language
- **MVP:** Content remains in original language (community-curated in English by default)
- Language indicator on content pages
- User can filter content by language (future enhancement)
- **Post-MVP:** Machine translation option for content
- Translation quality disclaimer when showing machine-translated content

**FR-13.3: Internationalization Infrastructure**
- Technical foundation for multi-language support
- i18n library integrated (e.g., i18next, react-intl, vue-i18n)
- Pluralization rules for different languages
- Date/time formatting per locale
- Number formatting per locale
- Currency formatting (if applicable)
- Translation management workflow
- Translation coverage monitoring

**FR-14.1: Newsletter Agent Configuration**
- Enterprise users configure newsletter generation agent with custom parameters
- **Prompt Configuration Panel:** Tone selection; Structure templates; Audience level; Focus areas
- Save multiple configurations
- Configuration presets for common newsletter types
- Natural language custom instructions field

**FR-14.2: Content Selection Interface**
- Select evidence and sources for newsletter generation
- **"Highly Rated News for This Week" View:** Show community-curated content; Show content from enterprise's custom sources; Filter by category, date range, topic
- **Evidence Selection:** Multi-select UI for picking supporting evidence; Mix community + private sources; Preview selected items
- **Source Selector:** Choose which sources newsletter references; Community sources + enterprise custom sources; Toggle sources on/off

**FR-14.3: Newsletter Draft Generation**
- One-click newsletter generation from configuration + selected evidence
- **One-Click Generation:** Click "Generate Draft" button; Agent synthesizes content; Output formats: Markdown, Plain Text, HTML; Generation completes in under 5 minutes
- **Draft Quality:** 90%+ of generated drafts require only minor edits; Proper citations and evidence attribution; Coherent structure; Matches specified tone and audience level
- **In-App Editor:** Rich text editor for refinement; Markdown editing mode; Preview mode; Track changes/edits

**FR-14.4: Version History & A/B Testing**
- Track draft versions for iterative refinement and A/B testing
- Automatic versioning on each regeneration or manual save
- Version history panel showing all previous drafts
- Compare versions side-by-side
- Restore previous version
- Tag versions for team collaboration
- Notes field per version

**FR-14.5: Email Distribution**
- Send finished newsletters to email lists
- Email list management (import, add, remove subscribers)
- Send preview to test emails
- Schedule send or send immediately
- HTML email rendering from draft
- Track send status (sent, failed, bounced)
- Basic analytics: open rate, click rate
- Integration with email service providers (SendGrid, Mailchimp, etc.)

**FR-14.6: Team Collaboration (Growth Phase)**
- Multi-user editing and approval workflows for Enterprise teams
- Role-based access: Writer, Editor, Approver
- Comment threads on drafts
- Approval workflow: Draft → Review → Approved → Scheduled
- Notification system for workflow state changes
- Activity log: who edited what and when

### NonFunctional Requirements

**NFR-P1: Page Load Performance**
- Pages load in under 2 seconds on 3G connection
- Time to First Contentful Paint (FCP): under 1 second
- Largest Contentful Paint (LCP): under 2.5 seconds
- Images and assets optimized for web delivery
- Lazy loading for images below the fold

**NFR-P2: API Response Time**
- API endpoints return responses in under 300ms (p95)
- Database queries optimized with indexes and caching
- Redis caching for frequently accessed content
- GraphQL/REST API efficient batch loading

**NFR-P3: Search Response Time**
- Search returns results in under 500ms
- Personalized search (paid users) under 700ms
- Search indexes updated within 1 minute of content updates
- Graceful degradation if search temporarily unavailable

**NFR-P4: Pipeline Processing Performance**
- Content ingestion: process 100+ items/hour
- AI scoring: complete scoring within 5 minutes of ingestion
- Deduplication check: under 100ms per item
- Writer Agent page generation: under 10 minutes per concept
- Database writes: batch operations for efficiency

**NFR-P5: Personalization Performance**
- Natural language criteria parsing: under 3 seconds
- Personalized feed generation: under 2 seconds
- Custom source ingestion: added to pipeline within 1 hour
- User preference updates: reflected immediately

**NFR-P6: Newsletter Studio Performance**
- Newsletter draft generation: under 5 minutes
- Version save: under 1 second
- Email send: queued immediately, sent within 5 minutes
- Large email lists (10,000+ subscribers): complete send within 30 minutes

**NFR-S1: Content Volume Scaling**
- Support 1,000+ pages without performance degradation
- Graph DB handles 10,000+ concept nodes with 100,000+ relationships efficiently
- Vector database handles 100,000+ embedded chunks efficiently
- Database handles millions of content records with efficient indexing

**NFR-S2: User Scaling**
- Handle 50,000 monthly active users (MAU)
- Support 500 concurrent paid users without degradation
- 50+ enterprise clients with separate newsletter workspaces
- Database connection pooling for efficiency
- Horizontal scaling for web servers

**NFR-S3: Traffic Scaling**
- Handle 500,000+ page views per month
- CDN handles traffic spikes
- Concurrent user capacity: 1,000+ simultaneous users
- Auto-scaling infrastructure responds to load within 2 minutes
- API rate limiting per user tier

**NFR-S4: Personalization Data Scaling**
- Support 500+ users with custom sources (avg 10 sources per user = 5,000 custom sources)
- Reading history: 1 million+ records efficiently queryable
- User preferences: instant updates and retrieval

**NFR-S5: Newsletter Studio Scaling**
- Support 50+ enterprise clients generating newsletters concurrently
- Email queue handles 100,000+ emails per hour
- Version history: 1,000+ versions per newsletter without performance impact
- Draft storage scales to 10,000+ drafts across all enterprise users

**NFR-S6: Contributor Scaling**
- Support 50+ active contributors (2.5x current team)
- Notion review workflow supports 10+ reviewers
- Clear contribution guidelines reduce maintainer bottleneck

**NFR-S7: Source Scaling**
- Content Ingestion Pipeline monitors 50+ community sources without degradation
- Support 5,000+ user-specific custom sources (paid tier)
- Add new sources without pipeline reconfiguration
- Handle 500+ new items per day during major release cycles

**NFR-R1: Application Uptime & Availability**
- 99.5% uptime target for web application (SLA for paid/enterprise tiers)
- 99.9% uptime for enterprise tier (higher SLA)
- Zero-downtime deployments (blue-green or rolling updates)
- Graceful degradation: read-only mode if write operations fail
- Automated health checks and monitoring
- Status page for transparency during incidents

**NFR-R2: Pipeline Reliability**
- Content ingestion: 99% successful pull rate from active sources
- AI scoring: 95% success rate (with retry logic)
- Weekly publish cycle: 100% execution (manual override if automation fails)
- Failed pipeline stages alert maintainers via notifications

**NFR-R3: Data Integrity**
- No data loss during pipeline processing
- Idempotent operations (re-running doesn't create duplicates)
- Postgres backups: daily with 30-day retention
- Graph DB backups: daily with 60-day retention
- Vector database backups: weekly with 60-day retention
- Git history serves as content version control

**NFR-R4: Error Recovery**
- Automated retry with exponential backoff for transient failures
- Dead-letter queue for permanently failed items
- Manual intervention workflow for critical failures
- Rollback capability for bad deployments

**NFR-SEC1: Credential Management**
- API keys stored in environment variables (not in code)
- GitHub Secrets for sensitive credentials in Actions
- Notion API tokens rotated quarterly
- LLM provider API keys with minimal required permissions
- Postgres credentials use strong passwords with limited access

**NFR-SEC2: Input Validation**
- URL submissions validated (format, domain, reachability)
- Markdown content sanitized to prevent XSS
- File uploads restricted (if implemented)
- Rate limiting on URL submission form (prevent spam)

**NFR-SEC3: Dependency Security**
- Automated dependency scanning (Dependabot, Snyk)
- Quarterly security updates for critical dependencies
- No known high-severity CVEs in production dependencies
- Python packages from trusted sources (PyPI)

**NFR-SEC4: User Authentication & Session Security**
- Secure password storage using bcrypt or argon2
- JWT tokens for session management with appropriate expiration
- OAuth2 implementation for third-party authentication (Google, GitHub)
- Password reset tokens expire after 24 hours
- Session invalidation on logout
- Multi-device session management
- Account lockout after 5 failed login attempts

**NFR-SEC5: Data Privacy & GDPR Compliance**
- Personal Data Collection: Email, name, reading history, preferences, custom sources
- User Rights: Right to access; Right to deletion; Right to portability; Right to opt-out
- Data Retention: Active accounts (indefinite); Deleted accounts (30 days); Billing records (7 years)
- Third-Party Data Sharing: No selling of user data; Data processing agreements with processors
- Encryption: Data in transit (TLS 1.3); Data at rest (Database encryption); Passwords (never stored in plaintext)
- Privacy Policy and Cookie Policy published
- Compliance: GDPR (EU), CCPA (California), PIPEDA (Canada)

**NFR-SEC6: Enterprise Data Isolation**
- Enterprise client data isolated (multi-tenancy security)
- Custom sources visible only to owning user/enterprise
- Newsletter drafts private to enterprise workspace
- No cross-enterprise data leakage
- Audit logs for enterprise actions

**NFR-A1: WCAG 2.1 AA Compliance**
- Keyboard navigation for all interactive elements
- Screen reader compatibility (semantic HTML, ARIA labels)
- Sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
- Alt text for all meaningful images
- Captions or transcripts for video content (if added)

**NFR-A2: Responsive Design**
- Mobile-friendly layout
- Touch targets minimum 44x44 pixels
- Text reflows without horizontal scrolling
- Font size user-adjustable via browser settings

**NFR-A3: Content Readability**
- Plain language where possible (technical terms explained)
- Hierarchical heading structure (H1 → H2 → H3)
- Lists for scannable content
- Code blocks with syntax highlighting
- Avoid jargon without definitions

**NFR-I1: Content Ingestion Pipeline Integration**
- Clean API contract between Content Ingestion Pipeline, Notion and Postgres
- Structured data format for content items (JSON schema)
- Error handling for malformed data
- Modular pipeline architecture for maintainability

**NFR-I2: Notion Integration**
- Notion API rate limits respected (3 requests/second)
- Robust handling of Notion API changes
- Fallback for Notion downtime (manual review queue)
- Export capability if Notion migration needed

**NFR-I3: GitHub Integration**
- GitHub Actions workflows reliable and maintainable
- Automated commits use dedicated bot account
- Webhook for deployment notifications

**NFR-I4: Graph Database Integration**
- Two-layer architecture (Concept Ontology, Evidence) consistently maintained
- Clean API for Writer Agent to query concepts, relationships, and evidence
- Support for Neo4j or compatible graph database
- Efficient graph traversal queries (under 500ms)
- Backup/restore procedures for all two layers
- Migration path if graph DB provider changes

**NFR-I5: Vector Database Integration**
- Pluggable architecture supports multiple providers (Milvus, ChromaDB, Pinecone)
- Consistent embedding format across providers
- Migration path between vector DB providers
- Backup/restore procedures documented
- Vector DB used only for deduplication (Graph DB is primary knowledge store)

**NFR-I6: Multi-LLM Provider Support**
- Graceful fallback between OpenAI, Gemini, Ollama
- Configuration-driven provider selection
- Cost tracking per provider
- Consistent output format across providers

**NFR-M1: Code Quality**
- Python code follows PEP 8 style guide
- Type hints for function signatures
- Comprehensive docstrings for public APIs
- Linting enforced in CI/CD (flake8, black)
- Unit test coverage target: 70%+

**NFR-M2: Documentation**
- README files in all major directories
- Architecture documentation
- Setup/installation guide for new contributors
- Troubleshooting guide for common issues
- API documentation for internal modules

**NFR-M3: Modularity**
- Clear separation of concerns (ingestion, scoring, synthesis, publishing)
- Operator pattern for content types (modular pipeline design)
- Pluggable components (LLM providers, vector databases)
- Configuration files, not hardcoded values

**NFR-M4: Monitoring & Observability**
- Structured logging for all pipeline stages
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Scheduler monitoring dashboard (job status, execution logs)
- GitHub Actions logs for build/deploy monitoring
- Alerting for critical failures (email, Slack)

**NFR-M5: Testing Strategy**
- Unit tests for core logic (deduplication, scoring algorithms)
- Integration tests for pipeline stages
- End-to-end smoke tests for full pipeline
- Manual testing checklist for deployments
- Test data fixtures for reproducible testing

**NFR-DQ1: Content Freshness**
- "Newly Discovered" updated at least weekly
- "Last updated" timestamps accurate to the hour
- Stale content flagged after 6 months (for Basics/Advanced)
- Major LLM releases reflected within 48 hours

**NFR-DQ2: Content Accuracy**
- Source citations required for all factual claims
- Contradictory information flagged and surfaced
- Error corrections within 24 hours of reported issue
- Community review before major updates

**NFR-DQ3: Metadata Quality**
- All pages have required frontmatter (title, date, category, tags)
- SEO metadata complete and descriptive
- Categories assigned consistently
- Tags follow controlled vocabulary

### Additional Requirements

**Infrastructure Requirements:**
- Tailscale for secure access to all infrastructure resources (Database access via Tailscale IP; Internal services communicate over Tailscale network; Development and production use same Tailscale net with ACL separation; No public endpoints for databases)
- Docker Compose for local development (PostgreSQL 16 with pgvector, port 5432; GraphDB, port 7200)
- Cron scheduling for pipeline jobs (weekly-publish.ts: Sunday 00:00 UTC; notion-backup.ts: Daily 00:00; news-ingestion.ts: Every 6 hours; writer-agent: Daily at 02:10)
- All jobs write results to pipeline_runs table with Slack + email alerts on failures

**Backup Strategy:**
- Evidence Layer (RDS): Automated RDS snapshots (Daily, 30 days retention); Point-in-time recovery (Continuous, 7-day window)
- Concept Layer (GraphDB): JSON/RDF export → S3 (Weekly, 60 days retention)
- Vector DB (pgvector): Included in RDS backups (Daily, with RDS)

**Environment Variables:**
- All credentials stored in environment variables only (never hardcoded, never committed)
- .env.example shows required keys with placeholder values
- Required: DATABASE_URL, GRAPH_DB_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, NOTION_API_TOKEN, NOTION_DATABASE_ID, GITHUB_PAT, GITHUB_REPO, MCP_SERVER_URL, SLACK_WEBHOOK_URL, ALERT_EMAIL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BACKUP_BUCKET

**Data Architecture Requirements:**
- Tenancy model: user is top-level tenant (no separate company/entity)
- News Pipeline: PostgreSQL 16 (crawl → dedup → per-user AI scoring → snapshots)
- Entity Registries: PostgreSQL 16 (KT-maintained master lists of tracked models, frameworks, tools, benchmarks)
- Books/Evidence Pipeline: PostgreSQL 16 (PDF/HTML → paragraphs → concept linkage → embeddings)
- Concept Layer: GraphDB (RDF) for Ontology (stable concept nodes + relationships)
- Personalization Layer: PostgreSQL 16 (per-user follow configs, scoring preferences, digest preferences, concept evidence selections)
- Webapp Read Layer: PostgreSQL 16 (pre-built UI snapshots; O(1) reads, no JOIN at request time)
- Operations: PostgreSQL 16 (run logs, processing progress, contributor registry)

**Epic to Architecture Mapping:**
- Epic 1: Foundation & Core Infrastructure - Databases, tooling, CI/CD, brownfield adaptation
- Epic 2: Newly Discovered Pipeline - News ingestion → Notion → Postgres backup → GitHub weekly
- Epic 3: Evidence Ingestion & Knowledge Graph - Documents → Evidence Layer → Concept Layer
- Epic 4: Writer Agent & Publication - Knowledge graph → synthesis → webapp content
- Epic 5: Community & Quality Operations - PR workflow, link validation, backup

### UX Design Requirements

**Design System Requirements:**
- Use shadcn/ui (New York style) + Tailwind CSS
- Light mode default with dark mode support (via next-themes)
- OKLCH color space for better color management
- Brand Colors: Cherry (#C94B6E), Violet (#7B5EA7), Success (#2D7A5E)
- Typography: Geist (primary), Plus Jakarta Sans (display), Inter (fallback)
- Responsive breakpoints: Mobile (default), Desktop (lg: 1024px+), Wide (1440px+)

**Custom Components (Implemented):**
- UX-DR1: Sidebar Navigation with tree-stem visual pattern and curved branches
- UX-DR2: Mobile Sidebar using Sheet component
- UX-DR3: Buzz Treemap for interactive category distribution visualization
- UX-DR4: Top Items List with star ratings and badges
- UX-DR5: Page Header component with title and subtitle
- UX-DR6: Handbook Placeholder for coming soon pages
- UX-DR7: Patch Notes Page with timeline
- UX-DR8: Concept Pages (frameworks, model updates, case studies)

**Accessibility Requirements:**
- WCAG 2.1 Level AA target
- Keyboard navigation for all interactive elements
- Focus indicators: 2px cherry outline
- Semantic HTML: nav, main, article, section
- ARIA labels for icons without visible text
- Touch targets: Minimum 44×44px on mobile

**Animation Requirements:**
- Base transitions: 150ms ease on interactive elements
- Skeleton loading: Pulse animation (1.5s infinite)
- Card hover: Shadow transition (150ms)
- Treemap hover: Brightness reduction (200ms)
- Toast: Slide in + fade (300ms)

**Layout Requirements:**
- Sidebar: 240px width (hidden on mobile)
- Content padding: 16px (mobile), 40px (desktop)
- Page title: 20px (mobile), 30px (desktop)
- Container max-width: 1440px
- Spacing scale: 4px grid base unit

### FR Coverage Map

**Epic 1 - Discover Curated Content (Universal):**
FR-1.1: Multi-Source Content Collection
FR-1.2: Intelligent Deduplication
FR-2.1: AI-Powered Content Scoring
FR-2.2: Knowledge Team Review Workflow
FR-2.3: Content Value Assessment
FR-5.1: Automated Publication Pipeline
FR-7.1: Content Source Configuration
FR-9.1: Vector Storage for Deduplication
→ Creates ONE weekly digest everyone sees

**Epic 2 - Learn Structured Concepts (Universal):**
FR-3.1: Graph Database Two-Layer Architecture
FR-3.2: Ontology Extraction & Concept Discovery
FR-3.3: Evidence Collection & Study Sessions
FR-4.1: MECE Knowledge Organization
FR-4.2: Writer Agent for Page Generation
FR-4.3: Concept Promotion Flow
FR-4.4: Evolving Taxonomy Management
FR-7.2: Curated Text Management
FR-8.1: Content Correction & Updates
→ Creates ONE knowledge base everyone references

**Epic 3 - Web Platform (Frontend + Contributor Tools):**
FR-5.2: Structured Content Display
FR-6.1: URL Submission for Sources
FR-8.1: Content Correction & Updates (contributor workflows)
All UX-DRs: 8 custom components + 50+ shadcn/ui components

**Epic 4 - Generate Newsletters:**
FR-14.1: Newsletter Agent Configuration
FR-14.2: Content Selection Interface
FR-14.3: Newsletter Draft Generation
FR-14.4: Version History & A/B Testing
FR-14.5: Email Distribution
FR-14.6: Team Collaboration

**Epic 5 - Personalize Your Feed:**
FR-10.1: User Registration & Login
FR-10.2: User Tier Management
FR-11.1: Custom Source Management
FR-11.2: Natural Language Scoring Criteria
FR-11.3: Content Filtering & Feed Personalization
FR-11.4: Adaptive Content Scoring

**Epic 6 - Build Your Knowledge Base:**
FR-10.3: User Profile Management
FR-12.1: User-Controlled Topic Addition
FR-12.2: Writer Agent Regeneration for Custom Topics
FR-12.3: User Knowledge Base Management

**Epic 7 - Access in Your Language:**
FR-13.1: Multi-Language UI
FR-13.2: Content Language Handling
FR-13.3: Internationalization Infrastructure

**All NFRs apply across all epics** (Performance, Scalability, Reliability, Security, Accessibility, Integration, Maintainability, Data Quality)

## Epic List

### Epic 1: Discover Curated Content (Universal Version)
Build the content pipeline that creates a single, high-quality weekly digest that **everyone** sees first. No personalization yet — one community-curated version for all users.
**FRs covered:** FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-2.3, FR-5.1, FR-7.1, FR-9.1

### Epic 2: Learn Structured Concepts (Universal Version)
Build the knowledge graph and Writer Agent that creates comprehensive concept pages. Again, **one version for everyone** — the authoritative knowledge base all users reference.
**FRs covered:** FR-3.1, FR-3.2, FR-3.3, FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-7.2, FR-8.1

### Epic 3: Web Platform (Frontend + Contributor Tools)
Connect your existing Next.js web frontend to the backend, making universal content accessible. Also add contributor tools so existing community members can easily submit sources and flag corrections.
**FRs covered:** FR-5.2, FR-6.1, FR-8.1 (contributor workflows)
**UX-DRs:** All 8 custom components + 50+ shadcn/ui components

### Epic 4: Generate Newsletters
Enterprise users can now generate newsletters from the universal content. Still **one version** being distributed to email lists, but now with newsletter generation workflows.
**FRs covered:** FR-14.1, FR-14.2, FR-14.3, FR-14.4, FR-14.5, FR-14.6

### Epic 5: Personalize Your Feed
**NOW** introduce personalization. Paid users can customize their experience — custom sources, scoring preferences, filtered feeds, adaptive ranking. The universal version remains the default for free users.
**FRs covered:** FR-10.1, FR-10.2, FR-11.1, FR-11.2, FR-11.3, FR-11.4

### Epic 6: Build Your Knowledge Base
Paid users can now create **personal concept pages** with custom evidence selection. The universal concept pages remain the default; users can opt into creating their own versions.
**FRs covered:** FR-10.3, FR-12.1, FR-12.2, FR-12.3

### Epic 7: Access in Your Language
Add internationalization so users worldwide can navigate the UI in their preferred language. Content remains in original languages with clear indicators.
**FRs covered:** FR-13.1, FR-13.2, FR-13.3

---

## Epic 1: Discover Curated Content (Universal Version)

Build the content pipeline that creates a single, high-quality weekly digest that **everyone** sees first. No personalization yet — one community-curated version for all users.

**FRs covered:** FR-1.1, FR-1.2, FR-2.1, FR-2.2, FR-2.3, FR-5.1, FR-7.1, FR-9.1

### Story 1.1: Status Check

As a developer working on this project,
I want a comprehensive audit of existing code, database schema, and infrastructure,
So that I understand the current state before making changes.

**Acceptance Criteria:**

**Given** the project repository exists
**When** I run the status check
**Then** a comprehensive report is generated documenting:
  - All existing database tables with their schemas
  - Current pipeline jobs and their schedules
  - Environment configuration status
  - Infrastructure components and their health
  - Any gaps or issues identified

**And** the report is saved to `{planning_artifacts}/status-check-report.md`

### Story 1.2: Daily Publication Pipeline

As a Knowledge Team member,
I want approved content to automatically publish daily from Notion to the live site,
So that new content reaches users quickly without manual deployment.

**Acceptance Criteria:**

**Given** the weekly publication pipeline exists (weekly-publish.ts)
**When** the daily publication job runs
**Then** approved Notion items are synced to Postgres and committed to webapp daily
**And** the job runs at a configured time (e.g., 00:00 UTC)
**And** the job writes results to `pipeline_runs` table
**And** failures trigger alerts (Discord + email)
**And** zero-downtime deployment is maintained

### Story 1.3: Discover & Configure Additional Source

As a Content Curator,
I want to discover and configure new content sources for the ingestion pipeline,
So that we can expand our content coverage beyond the initial sources.

**Acceptance Criteria:**

**Given** the content ingestion pipeline exists
**When** I add a new source (Twitter, Discord, GitHub, RSS, blog)
**Then** the source is validated (URL format, reachability)
**And** the source is added to the source configuration
**And** I can assign category mapping and polling frequency
**And** the source appears in the source health monitoring
**And** I can enable/disable the source toggle
**And** content from the new source starts being ingested

---

## Epic 2: Learn Structured Concepts (Universal Version)

Build the knowledge graph and Writer Agent that creates comprehensive concept pages. One version for everyone — the authoritative knowledge base all users reference.

**FRs covered:** FR-3.1, FR-3.2, FR-3.3, FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-7.2, FR-8.1

### Story 2.1: Status Check

As a developer working on the knowledge graph,
I want a comprehensive audit of existing GraphDB, evidence layer, and related infrastructure,
So that I understand the current state before making changes.

**Acceptance Criteria:**

**Given** the project repository exists
**When** I run the knowledge graph status check
**Then** a comprehensive report is generated documenting:
  - GraphDB schema (Concept and Evidence layers)
  - Existing concept nodes and relationships
  - Evidence layer data (texts, chunks, metadata)
  - Ontology extraction job status and schedule
  - Writer Agent configuration and recent runs
  - Any gaps or issues identified

**And** the report is saved to `{planning_artifacts}/kg-status-check-report.md`

### Story 2.2: Pipeline Integration

As a Knowledge Team member,
I want a unified pipeline that connects evidence ingestion, ontology extraction, and writer agent,
So that the entire knowledge graph workflow runs seamlessly from source to published page.

**Acceptance Criteria:**

**Given** evidence ingestion, ontology extraction, and writer agent exist individually
**When** I run the integrated knowledge graph pipeline
**Then** evidence is ingested and stored in Evidence Layer
**And** ontology extraction discovers and adds new concepts
**And** Writer Agent generates pages for all updated concepts
**And** the pipeline runs on a schedule (e.g., monthly after concept review)
**And** the job writes results to `pipeline_runs` table
**And** failures trigger alerts (Slack + email)
**And** generated pages are ready for publication

### Story 2.3: Content Discovery for Initial Seeding & Ontology Creation

As a Knowledge Team member,
I want to discover quality educational content for LLM engineers and create an initial ontology from it,
So that we have a solid foundation of concepts and evidence to build upon.

**Acceptance Criteria:**

**Given** the project needs initial knowledge base content
**When** I execute the content discovery and ontology creation process
**Then** quality sources are identified (papers, documentation, canonical posts, books)
**And** sources are relevant to LLM engineering education
**And** content is ingested into Evidence Layer with proper metadata
**And** noun phrases are extracted from evidence paragraphs
**And** word count and frequency metrics filter noise vs meaningful concepts
**And** LLM-assisted concept relationship detection identifies: prerequisite, related, subtopic, extends, contradicts
**And** initial ontology is created with core concepts and relationships
**And** concepts are organized into Basics and Advanced sections
**And** Knowledge Team reviews and approves the initial ontology
**And** results are logged for audit trail

---

## Epic 3: Web Platform (Frontend + Contributor Tools)

Connect your existing Next.js web frontend to the backend, making universal content accessible. Also add contributor tools so existing community members can easily submit sources.

**FRs covered:** FR-5.2, FR-6.1, FR-8.1 (contributor workflows)
**UX-DRs:** All 8 custom components + 50+ shadcn/ui components

### Story 3.1: Backend Integration

As a user,
I want to view curated content from the Postgres backend on the web frontend,
So that I can access the knowledge base through a browser.

**Acceptance Criteria:**

**Given** the Next.js frontend exists
**Given** content is stored in Postgres (from Epic 1 and Epic 2 pipelines)
**When** I navigate to the site
**Then** content is fetched from Postgres and displayed
**And** the 3-section navigation is rendered (Basics, Advanced, Newly Discovered)
**And** each section shows the appropriate content
**And** pages render with proper markdown formatting
**And** "Last updated" timestamps are displayed

### Story 3.2: URL Submission Form

As a community contributor,
I want to submit URLs for new content sources through a web form,
So that the Content Ingestion Pipeline can monitor them.

**Acceptance Criteria:**

**Given** the URL submission page exists
**When** I submit a URL (Twitter, Discord, GitHub, RSS, blog)
**Then** the URL is validated for format and reachability
**And** the submission is queued for maintainer review
**And** I receive feedback on submission status (pending/approved/rejected)
**And** approved URLs are added to the source configuration
**And** rate limiting prevents spam submissions

### Story 3.3: Markdown Submission Page

As a Knowledge Team member,
I want to submit markdown content (papers, documentation, canonical posts) through a web form,
So that it triggers the evidence ingestion pipeline from Epic 2.

**Acceptance Criteria:**

**Given** the markdown submission page exists
**When** I submit markdown content or a URL
**Then** the content is queued for evidence ingestion pipeline
**And** the pipeline extracts and chunks the text into paragraphs
**And** chunks are stored in the Evidence Layer with metadata (source, date, topic)
**And** embeddings are generated for deduplication
**And** I can track the ingestion status (queued/processing/completed)
**And** completed content is ready for ontology extraction and Writer Agent

---

## Epic 4: Generate Newsletters

Enterprise users can now generate newsletters from the universal content. Still **one version** being distributed to email lists, but now with newsletter generation workflows.

**FRs covered:** FR-14.1, FR-14.2, FR-14.3, FR-14.5

### Story 4.1: Newsletter Agent Configuration

As an Enterprise user,
I want to configure newsletter generation parameters (tone, structure, audience level),
So that the generated newsletters match my brand and communication style.

**Acceptance Criteria:**

**Given** I have Enterprise tier access
**When** I access the Newsletter Configuration Panel
**Then** I can set tone selection (professional, casual, technical)
**And** I can select structure templates (weekly digest, deep dive, quick hits)
**And** I can specify audience level (beginner, intermediate, advanced)
**And** I can set focus areas for content prioritization
**And** I can save multiple named configurations
**And** I can use natural language custom instructions field
**And** I can select from configuration presets for common newsletter types

### Story 4.2: Content Selection Interface

As an Enterprise user,
I want to select evidence and sources for newsletter generation from a curated interface,
So that I can control what content appears in my newsletter.

**Acceptance Criteria:**

**Given** I have Enterprise tier access
**When** I access the Content Selection Interface
**Then** I see "Highly Rated News for This Week" view with community-curated content
**And** I can filter content by category, date range, and topic
**And** I can multi-select evidence items with a checkbox UI
**And** I can mix community and private sources in my selection
**And** I can preview selected items before generation
**And** I can toggle sources on/off to control what the newsletter references
**And** my selections persist until I change them

### Story 4.3: Newsletter Draft Generation

As an Enterprise user,
I want to generate newsletter drafts with one click from my configuration and selected evidence,
So that I can quickly create newsletters without manual writing.

**Acceptance Criteria:**

**Given** I have configured newsletter parameters
**And** I have selected content evidence
**When** I click "Generate Draft"
**Then** the agent synthesizes content from my configuration and selections
**And** output is available in Markdown, Plain Text, and HTML formats
**And** generation completes within 5 minutes
**And** 90%+ of generated drafts require only minor edits
**And** proper citations and evidence attribution are included
**And** the structure is coherent and matches specified tone
**And** an in-app editor is available for refinement (Markdown mode, Preview mode)

### Story 4.4: Email Distribution

As an Enterprise user,
I want to send finished newsletters to my email lists,
So that my subscribers receive the content on my schedule.

**Acceptance Criteria:**

**Given** I have a completed newsletter draft
**When** I access the Email Distribution interface
**Then** I can manage email lists (import, add, remove subscribers)
**And** I can send a preview to test emails
**And** I can schedule send for a specific time or send immediately
**And** HTML email is rendered properly from my draft
**And** I can track send status (sent, failed, bounced)
**And** basic analytics are available (open rate, click rate)
**And** integration works with email service providers (SendGrid, Mailchimp, etc.)

---

## Epic 5: Personalize Your Feed

NOW introduce personalization. Paid users can customize their experience — custom sources, scoring preferences, filtered feeds, adaptive ranking. The universal version remains the default for free users.

**FRs covered:** FR-10.1, FR-10.2, FR-11.1, FR-11.2, FR-11.3, FR-11.4

### Story 5.1: User Registration & Login

As a new user,
I want to register for an account and log in securely,
So that I can access personalized features and manage my preferences.

**Acceptance Criteria:**

**Given** I am a new user
**When** I register for an account
**Then** I can sign up with email/password (with email verification)
**And** I can sign up with OAuth (Google, GitHub)
**And** my password is securely hashed (bcrypt/argon2)
**And** I receive a password reset flow via email
**And** my session is managed with JWT tokens
**And** I can log out and invalidate my session

**Given** I have an existing account
**When** I log in with valid credentials
**Then** I am authenticated and redirected to the dashboard
**And** after 5 failed login attempts, my account is locked for security

### Story 5.2: User Tier Management

As a platform administrator,
I want to manage user tiers (Free, Paid, Enterprise) with appropriate feature access,
So that users have the right features based on their subscription level.

**Acceptance Criteria:**

**Given** the user tier system exists
**When** a user accesses any feature
**Then** Free tier users can access all community content (no account required for read-only)
**And** Paid tier users have access to personalization, custom sources, adaptive KB
**And** Enterprise tier users have everything in Paid + Newsletter Studio
**And** tier-based feature gating is enforced in UI and API
**And** users can upgrade/downgrade with proration
**And** billing integration works with Stripe or similar
**And** account changes (email, tier) require verification

### Story 5.3: Custom Source Management

As a Paid tier user,
I want to add and manage private sources beyond the community-curated content,
So that my feed includes content from sources I care about.

**Acceptance Criteria:**

**Given** I have Paid tier access
**When** I access Custom Source Management
**Then** I can add/remove custom source URLs (RSS, Twitter, blogs, etc.)
**And** I can toggle which community sources to follow
**And** each source is validated (reachable, valid format)
**And** the Content Ingestion Pipeline ingests my custom sources
**And** content from my custom sources is visible only to me
**And** I can view all my sources with active/inactive status
**And** new sources are added to the pipeline within 1 hour

### Story 5.4: Natural Language Scoring Criteria

As a Paid tier user,
I want to define my content scoring preferences in natural language,
So that the AI interprets and applies my personal criteria to content ranking.

**Acceptance Criteria:**

**Given** I have Paid tier access
**When** I access the Scoring Preferences interface
**Then** I see an input field for natural language criteria
**And** I can enter preferences like "prioritize practical tutorials over theory"
**And** the AI parses my criteria and generates scoring weights
**And** I see a confirmation UI showing the interpreted weights
**And** I can refine and iterate until satisfied
**And** my scoring preferences are applied to feed ranking
**And** community scoring remains the default for users who don't customize
**And** I can see score explanations for why content ranked high

### Story 5.5: Content Filtering & Feed Personalization

As a Paid tier user,
I want to personalize my "Newly Discovered" feed through entity-level follows and category-level filtering,
So that I see only content relevant to my interests.

**Acceptance Criteria:**

**Given** I have Paid tier access
**When** I access Feed Personalization settings
**Then** I can follow or unfollow specific tracked entities (models, frameworks, tools)
**And** I can assign per-entity weight (high/medium/low interest)
**And** I can show/hide entire category groups
**And** I can assign per-category weights
**And** my personalized "For You" page shows filtered + reranked articles
**And** ranking signals include my user_article_state.impact_score
**And** Community page is shown as fallback
**And** I can easily toggle between "Community" and "For You" views
**And** Free users see full community-curated content without personalization

### Story 5.6: Adaptive Content Scoring

As a Paid tier user,
I want my custom scoring criteria applied to all content ranking,
So that my feeds prioritize what matters most to me.

**Acceptance Criteria:**

**Given** I have configured custom scoring preferences
**When** I view any content feed or ranking
**Then** my user-defined scoring weights are applied to all content
**And** "Newly Discovered" feed is reranked based on my criteria
**And** score explanations show "This scored high because of your preference for X"
**And** I can compare community score vs personal score (A/B view)
**And** my preferences are reflected immediately when updated
**And** default community scoring applies to users without custom criteria

---

## Epic 6: Build Your Knowledge Base

Paid users can now create **personal concept pages** with custom evidence selection. The universal concept pages remain the default; users can opt into creating their own versions.

**FRs covered:** FR-10.3, FR-12.1, FR-12.2, FR-12.3

### Story 6.1: User Profile Management

As a logged-in user,
I want to manage my account settings and preferences,
So that I have control over my profile and data.

**Acceptance Criteria:**

**Given** I am logged in
**When** I access my profile page
**Then** I can view my profile information (name, email, tier, join date)
**And** I can update my account preferences
**And** I can request account deletion (GDPR compliance)
**And** I can export my user data (GDPR compliance)
**And** I can view my reading history (Paid tier users)
**And** I can change my email with verification
**And** all changes are saved immediately

### Story 6.2: User-Controlled Topic Addition

As a Paid tier user,
I want to add custom topics with reference articles,
So that I can build a personal knowledge base beyond the community content.

**Acceptance Criteria:**

**Given** I have Paid tier access
**When** I access the custom topics interface
**Then** I can add a new topic (not in community KB)
**And** I can provide topic name, category (Basics/Advanced), and description
**And** I can upload or link reference articles/evidence
**And** evidence is extracted from my provided references
**And** evidence is stored in my user-specific evidence layer linked to Graph DB
**And** my custom topics are visible only to me
**And** there's clear distinction between community content and my personal custom content

### Story 6.3: Writer Agent Regeneration for Custom Topics

As a Paid tier user,
I want to generate concept pages for my custom topics using the Writer Agent,
So that I can have comprehensive, well-structured personal knowledge pages.

**Acceptance Criteria:**

**Given** I have created a custom topic with evidence
**When** I click "Generate Page" for that topic
**Then** the Writer Agent loads my custom evidence
**And** the agent generates a page in four-section format (Overview → Cherries → Child Concepts → Progressive References)
**And** the page is saved in my personal knowledge base
**And** generation completes within 10 minutes
**And** I can iterate by adding more evidence and regenerating
**And** my generated pages follow the same structure as community pages

### Story 6.4: User Knowledge Base Management

As a Paid tier user,
I want to manage my custom topics and personal knowledge base,
So that I can organize and maintain my personal content.

**Acceptance Criteria:**

**Given** I have Paid tier access and custom topics
**When** I access my Knowledge Base Management interface
**Then** I can view all my custom topics in a list view
**And** I can edit/delete custom topics
**And** I can add/remove/edit reference articles for topics
**And** I can trigger regeneration after making changes
**And** I can export my personal KB to markdown
**And** there's clear visual distinction between community content and personal custom content
**And** I can navigate between my custom topics and community topics

---

## Epic 7: Access in Your Language

Add internationalization so users worldwide can navigate the UI in their preferred language. Content remains in original languages with clear indicators.

**FRs covered:** FR-13.1, FR-13.2, FR-13.3

### Story 7.1: Internationalization Infrastructure

As a developer,
I want to set up the technical foundation for multi-language support,
So that the platform can be easily localized for different languages.

**Acceptance Criteria:**

**Given** the Next.js application exists
**When** I implement internationalization infrastructure
**Then** an i18n library is integrated (i18next, react-intl, or vue-i18n)
**And** translation files are structured in JSON format
**And** pluralization rules are configured for different languages
**And** date/time formatting adapts per locale
**And** number formatting adapts per locale
**And** currency formatting is configured (if applicable)
**And** translation coverage monitoring is in place
**And** adding new languages is a simple process

### Story 7.2: Multi-Language UI

As a user,
I want to navigate the platform interface in my preferred language,
So that I can use the site comfortably regardless of which languages I speak.

**Acceptance Criteria:**

**Given** the i18n infrastructure is in place
**When** I access the platform
**Then** I can select my language from a language selector in the header and user settings
**And** all UI elements are translated (navigation, buttons, labels, form fields, error messages)
**And** English is the primary language with Korean as the initial secondary language
**And** my language preference is saved (for logged-in users)
**And** browser language detection works for non-logged-in users (fallback to English)
**And** RTL (Right-to-Left) layout support is available for future languages
**And** translations are consistently applied across all pages

### Story 7.3: Content Language Handling

As a user,
I want to see clear language indicators on content pages,
So that I understand which language the content is in (separate from the UI language).

**Acceptance Criteria:**

**Given** the platform has multi-language UI
**When** I view any content page
**Then** a language indicator is displayed showing the content's original language
**And** the content remains in its original language (community content is English by default)
**And** there is a clear distinction between UI language and content language
**And** users can filter content by language (future enhancement placeholder)
**And** machine-translated content (when added) includes a quality disclaimer
**And** the language indicator is consistent across all content types
