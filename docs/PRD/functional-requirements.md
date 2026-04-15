# Functional Requirements

Organized by user-facing capabilities, each requirement connects to the core product value: **helping practitioners find clarity, confidence, and speed in the rapidly-evolving LLM landscape.**

## 1. Content Ingestion & Aggregation

**FR-1.1: Multi-Source Content Collection**

- **Description:** Automatically aggregate LLM-related content from diverse sources (Twitter, Discord, GitHub, papers, blogs, RSS feeds)
- **Acceptance Criteria:**
  - Content Ingestion Pipeline pulls from at least 10 configured sources
  - New content discovered within 24 hours of publication
  - Source metadata preserved (URL, date, author, platform)
  - Configurable source priorities and categories

**FR-1.2: Intelligent Deduplication**

- **Description:** Identify and filter duplicate or redundant content before processing
- **Acceptance Criteria:**
  - Content-level deduplication before scoring (exact matches, near-duplicates)
  - Chunk-level deduplication for Basics/Advanced synthesis (paragraph similarity)
  - 95%+ accuracy in identifying true duplicates
  - Preserve original source for merged duplicates
- **Domain Constraint:** Must run before AI scoring to reduce API costs

## 2. Content Quality Assessment

**FR-2.1: AI-Powered Content Scoring**

- **Description:** Automatically evaluate content relevance and quality on 1-5 scale
- **Acceptance Criteria:**
  - AI agent scores content based on defined criteria (relevance, depth, novelty, practicality)
  - Score 5 = top-tier content worthy of inclusion
  - Scoring completes within 5 minutes of ingestion
  - Pattern-based learning improves scoring accuracy over time

**FR-2.2: Knowledge Team Review Workflow**

- **Description:** Structured weekly review and approval process managed by Knowledge Team in Notion
- **Acceptance Criteria:**
  - Score-5 items auto-assigned to Knowledge Team members in Notion
  - Team members can validate summaries, adjust scores, and request edits
  - Weekly review cycle (Wednesday) with structured meeting
  - LLM-assisted ontology graph mapping during review
  - Status tracking: pending → in_review → finished
  - Top 20 finished items (score 5) flow to newsletter generation
  - Audit trail of all review decisions

**FR-2.3: Content Value Assessment**

- **Description:** AI identifies unique, value-adding information vs repetitive noise
- **Acceptance Criteria:**
  - Chunk-level (paragraph) analysis for novelty
  - Comparison against vector database of existing content
  - "Unique" flag for truly novel information
  - Value score based on: novelty, depth, practical applicability, evidence quality

## 3. Knowledge Graph & Database Management

**FR-3.1: Graph Database Two-Layer Architecture**

- **Description:** Concept-centric knowledge system with stable ontology and dynamic evidence
- **Acceptance Criteria:**

  **Concept Layer (Stable):**
  - Store concepts as unique noun-phrase nodes only (no sentences, no examples in nodes)
  - Concepts must be reusable across all sources
  - Relation types: prerequisite, related, subtopic, extends, contradicts (dynamic, extensible)
  - Evidence NEVER stored in concept nodes (only linked)
  - Concept schema: title, summary, relations (with embedded evidence previews), sources, contributors
  - Concepts must support dynamic relation block rendering in UI

  **Evidence Layer (High Volume):**
  - Store paragraphs/snippets separately from concepts
  - Required metadata: source, location, text, excerpt, comment, tags, linked_concepts
  - Evidence types: paraphrase, direct quote, figure reference
  - Evidence can link to multiple concepts (many-to-many)
  - Evidence previews format: excerpt + source + comment (shown in relation blocks)

  **Performance:**
  - Graph queries complete in under 500ms for writer agent
  - Support concurrent reads during page generation
  - Efficient traversal for concept → related concepts → evidence chains

  **Integration:**
  - Coexists with Vector DB (used only for deduplication)
  - Graph view shows concepts only (no evidence nodes cluttering visualization)

**FR-3.2: Ontology Extraction & Concept Discovery**

- **Description:** Monthly extraction of new concept noun phrases from evidence layer
- **Acceptance Criteria:**
  - Monthly batch job (2nd Saturday) extracts new concept candidates from evidence layer
  - Word count and frequency metrics filter noise vs meaningful concepts
  - LLM-assisted concept relationship detection
  - Concept candidates presented to Knowledge Team for review
  - Approved concepts added to Ontology Layer with initial relationships
  - New concepts default to Advanced section (promotion to Basics based on sustained importance)

**FR-3.3: Evidence Collection & Study Sessions**

- **Description:** Knowledge Team study sessions populate Evidence Layer with curated texts
- **Acceptance Criteria:**
  - Wednesday study sessions review texts (books, papers, documentation)
  - Reviewed texts stored in Evidence Layer with metadata (source, date, topic, quality)
  - Text chunking for efficient storage and retrieval
  - Evidence tagged with relevant concept associations
  - Study session notes captured for context

## 4. AI Synthesis & Knowledge Structuring

**FR-4.1: MECE Knowledge Organization**

- **Description:** Structure content into Mutually Exclusive, Collectively Exhaustive taxonomy
- **Acceptance Criteria:**
  - 3 main sections: Basics, Advanced, Newly Discovered
  - 2-level hierarchy: parent concepts → child implementations
  - No concept should fit in multiple categories
  - All LLM engineering topics covered (95% coverage target)
  - Taxonomy evolves based on emerging topics

**FR-4.2: Writer Agent for Page Generation**

- **Description:** AI agent generates Basics/Advanced pages from knowledge graph using structured schemas
- **Acceptance Criteria:**
  - **Input:** Concept node from Ontology Layer (triggered monthly after concept review)
  - **Step 1:** Query CONCEPT schema from Graph DB
    - Load target concept + connected concepts + relationships
    - Retrieve relation types (prerequisite, related, subtopic, extends, contradicts)
  - **Step 2:** Query EVIDENCE schema to retrieve full evidence details
    - Full text, excerpts, source metadata, comment types
  - **Step 3:** Generate page structure following Concept Page UI Design:
    - Title and summary
    - Dynamic relation blocks (only non-empty sections)
    - Evidence previews embedded in each relation item
    - Sources & Commentary section with reading order
    - Contributors list
  - **Step 4:** Compose page content by:
    - Citing evidence with proper attribution
    - Paraphrasing where appropriate
    - Maintaining evidence preview format (excerpt + source + comment type)
    - Including "why" explanations for each relation
  - Generated pages follow style guide (clarity, examples, trade-offs)
  - Flag conflicting evidence from multiple sources for Knowledge Team review
  - Page generation completes within 10 minutes per concept
  - Output: Markdown file conforming to Concept Page Structure
- **Domain Constraint:** EdTech quality standards - must be accurate and pedagogically sound

**FR-4.3: Concept Promotion Flow (Advanced → Basics)**

- **Description:** Promote concepts from Advanced to Basics based on sustained importance
- **Acceptance Criteria:**
  - New concepts default to Advanced section
  - Metric-based evaluation tracks concept importance over time (mentions, usage, stability)
  - Monthly Knowledge Team review (2nd Saturday) evaluates promotion candidates
  - Promoted concepts move from Advanced → Basics with page updates
  - Promotion decisions documented with rationale

**FR-4.4: Evolving Taxonomy Management**

- **Description:** Continuously update content categories as LLM field evolves
- **Acceptance Criteria:**
  - New categories can be added without restructuring
  - Content can be reassigned when taxonomy changes
  - Category deprecation with content migration plan
  - "Newly Discovered" categories reviewed quarterly for relevance

## 5. Content Publishing & Distribution

**FR-5.1: Automated Publication Pipeline**

- **Description:** Approved content automatically flows from Notion → Public site
- **Acceptance Criteria:**
  - Weekly batch: Notion → Cherry app update (markdown files)
  - Zero-downtime deployments
  - Rollback capability for broken builds

**FR-5.2: Structured Content Display**

- **Description:** Cherry renders content with professional layout and navigation
- **Acceptance Criteria:**
  - 3-section navigation (Basics, Advanced, Newly Discovered)
  - 2-level TOC with parent-child hierarchy
  - Built-in search functionality
  - Mobile-responsive design
  - Syntax highlighting for code
  - "Last updated" timestamps
  - Breadcrumb navigation

## 6. Content Contribution & Collaboration

**FR-6.1: URL Submission for Sources**

- **Description:** Community submits URLs for Content Ingestion Pipeline to monitor
- **Acceptance Criteria:**
  - Form/interface for URL submission
  - Validation: URL format, domain reachability
  - Queue for maintainer review
  - Approved URLs added to Content Ingestion Pipeline source list
  - Feedback to submitter (approved/rejected/reason)

## 7. Content Source Management

**FR-7.1: Content Source Configuration**

- **Description:** Manage which sources Content Ingestion Pipeline monitors for "Newly Discovered"
- **Acceptance Criteria:**
  - Configuration file lists: source URL, category mapping, polling frequency
  - Sources include: Twitter accounts, Discord channels, GitHub orgs, RSS feeds, blogs
  - Per-source enable/disable toggle
  - Source health monitoring (last successful pull, error rate)

**FR-7.2: Curated Text Management for Basics/Advanced**

- **Description:** Manage library of curated sources (books, papers, canonical posts)
- **Acceptance Criteria:**
  - Document registry: source metadata (title, author, URL, PDF, publication date)
  - Extraction pipeline: PDF → text, web → markdown
  - Version tracking for updated sources
  - Source prioritization (canonical vs supplementary)

## 8. Quality Control & Moderation

**FR-8.1: Content Correction & Updates**

- **Description:** Fix errors, update outdated information, improve clarity
- **Acceptance Criteria:**
  - Error reporting mechanism (GitHub issues)
  - Critical corrections deployed within 4 hours of discovery
  - "Last updated" dates show freshness
  - Changelog for major page updates
  - Deprecated content marked clearly with alternatives

## 9. Vector Database & Semantic Search (Backend)

**FR-9.1: Vector Storage for Deduplication**

- **Description:** Store embeddings of all unique content chunks
- **Acceptance Criteria:**
  - Embeddings generated for all approved content
  - Vector database indexes: source, category, date, topic
  - Similarity search: cosine similarity threshold for duplicates
  - Efficient querying (under 100ms for similarity check)

## 10. User Management & Authentication

**FR-10.1: User Registration & Login**

- **Description:** Secure user account creation and authentication system
- **Acceptance Criteria:**
  - Email/password registration with email verification
  - OAuth login (Google, GitHub)
  - Password reset flow
  - JWT-based session management
  - Secure password hashing (bcrypt/argon2)
  - Account email change with verification

**FR-10.2: User Tier Management**

- **Description:** Support Free, Paid, and Enterprise tiers with appropriate feature access
- **Acceptance Criteria:**
  - Free tier: Access to all community content (no account required for read-only)
  - Paid tier: Personalization, custom sources, adaptive KB
  - Enterprise tier: Everything in Paid + Newsletter Studio
  - Tier-based feature gating in UI and API
  - Upgrade/downgrade flows with proration
  - Billing integration (Stripe or similar)

**FR-10.3: User Profile Management**

- **Description:** Users can manage their account settings and preferences
- **Acceptance Criteria:**
  - Profile page: name, email, tier, join date
  - Preference management (separate from personalization settings)
  - Account deletion (GDPR compliance)
  - Export user data (GDPR compliance)
  - Reading history view (paid users)

## 11. Personalization Engine

**FR-11.1: Custom Source Management**

- **Description:** Users can add private sources beyond community-curated content
- **Acceptance Criteria:**
  - Add/remove custom source URLs (RSS, Twitter, blogs, etc.)
  - Toggle which community sources to follow
  - Source validation (reachable, valid format)
  - Content Ingestion Pipeline ingests user's custom sources
  - Content from custom sources only visible to that user
  - Source management UI with active/inactive status

**FR-11.2: Natural Language Scoring Criteria (Paid Tier)**

- **Description:** Users define scoring preferences in natural language, AI interprets into weights
- **Acceptance Criteria:**
  - Input field for natural language criteria (e.g., "I care more about business cases than model updates")
  - AI parses criteria and generates scoring weights
  - Confirmation UI showing interpreted weights
  - User can refine and iterate
  - Scoring applies to feed ranking and content prioritization
  - Default community scoring for users who don't customize

**FR-11.3: Content Filtering & Feed Personalization (Paid Tier)**

- **Description:** Paid users personalize "Newly Discovered" through two complementary controls: (1) entity-level follows from the registry and (2) category-level filtering. Together these determine which articles surface and in what order.
- **Acceptance Criteria:**
  - **Entity Follow (Registry-level):**
    - Follow or unfollow specific tracked entities (models, frameworks, tools, benchmarks, etc.) from the registry
    - Assign per-entity weight (e.g., Claude = 2×, GPT = 1×) to influence ranking
    - Articles mentioning followed entities are surfaced; unfollowed entities are excluded
    - Absence of a follow config = neutral (all entities shown at weight 1.0)
  - **Category Filtering:**
    - Show/hide entire category groups (e.g., hide Model Updates, show only Business Cases)
    - Assign per-category weight to influence ranking within shown categories
    - Filters apply across all Newly Discovered category pages
  - **Personalized Page Output:**
    - Newly Discovered category pages show a filtered + reranked article list (no synthesis — same structure as community pages)
    - Ranking signal: `user_article_state.impact_score` (reflects source weights, entity weights, and scoring preferences)
    - Community page shown as fallback for categories with no user preference set
  - Free users see full community-curated content; paid users see filtered/reranked view
  - All preferences persist across sessions
  - Easy toggle between "Community" and "For You" views per category page

**FR-11.4: Adaptive Content Scoring**

- **Description:** Apply user's custom scoring criteria to content ranking
- **Acceptance Criteria:**
  - User-defined scoring weights applied to all content
  - Re-ranking of "Newly Discovered" feed based on user criteria
  - Score explanations: "This scored high because of your preference for X"
  - A/B comparison: community score vs personal score

## 12. Custom Knowledge Base (Adaptive KB) - Paid Tier

**FR-12.1: User-Controlled Topic Addition**

- **Description:** Paid users can add custom topics with reference articles
- **Acceptance Criteria:**
  - UI for adding new topics (not in community KB)
  - Upload or link reference articles/evidence
  - Topic name, category (Basics/Advanced), and description
  - Evidence extraction from user-provided references
  - Store in user-specific evidence layer linked to Graph DB
  - User's custom topics visible only to them

**FR-12.2: Writer Agent Regeneration for Custom Topics**

- **Description:** Users command Writer Agent to generate pages for their custom topics
- **Acceptance Criteria:**
  - User clicks "Generate Page" for custom topic
  - Writer Agent loads user's custom evidence
  - Generates page in four-section format (Overview → Cherries → Child Concepts → Progressive References)
  - Page saved in user's personal knowledge base
  - Regeneration takes under 10 minutes
  - User can iterate: add more evidence → regenerate

**FR-12.3: User Knowledge Base Management**

- **Description:** Manage custom topics and personal knowledge base
- **Acceptance Criteria:**
  - View all custom topics (list view)
  - Edit/delete custom topics
  - Add/remove/edit reference articles for topics
  - Trigger regeneration after changes
  - Export personal KB to markdown
  - Distinction between community content and personal custom content

## 13. Internationalization & Multi-Language Support

**FR-13.1: Multi-Language UI**

- **Description:** Platform interface available in multiple languages for global accessibility
- **Acceptance Criteria:**
  - **Initial Languages:** English (primary), Korean
  - Language selector in user settings and header
  - All UI elements translated: navigation, buttons, labels, form fields, error messages
  - User language preference saved (logged-in users)
  - Browser language detection for non-logged-in users (fallback to English)
  - RTL (Right-to-Left) layout support for future languages (Arabic, Hebrew)
  - Translation files: JSON-based i18n format
  - Easy addition of new languages (modular translation files)

**FR-13.2: Content Language Handling**

- **Description:** Clear distinction between UI language and content language
- **Acceptance Criteria:**
  - **MVP:** Content remains in original language (community-curated in English by default)
  - Language indicator on content pages (e.g., "Content in English")
  - User can filter content by language (future enhancement)
  - **Post-MVP:** Machine translation option for content (powered by AI)
  - Translation quality disclaimer when showing machine-translated content

**FR-13.3: Internationalization Infrastructure**

- **Description:** Technical foundation for multi-language support
- **Acceptance Criteria:**
  - i18n library integrated with standard JSON-based format support
  - Pluralization rules for different languages
  - Date/time formatting per locale (e.g., MM/DD/YYYY vs DD/MM/YYYY)
  - Number formatting per locale (e.g., 1,000.50 vs 1.000,50)
  - Currency formatting (if applicable in future)
  - Translation management workflow (how team updates translations)
  - Translation coverage monitoring (ensure all UI strings translated)

## 14. Newsletter Studio - Enterprise Tier

**FR-14.1: Newsletter Agent Configuration**

- **Description:** Enterprise users configure newsletter generation agent with custom parameters
- **Acceptance Criteria:**
  - **Prompt Configuration Panel:**
    - Tone selection: Professional, Casual, Technical, Friendly, etc.
    - Structure templates: Intro → Highlights → Deep Dive → Conclusion, etc.
    - Audience level: Beginner, Intermediate, Expert
    - Focus areas: Business, Technical, Research, Product, Mixed
  - Save multiple configurations (e.g., "Weekly Tech Brief", "Monthly Executive Summary")
  - Configuration presets for common newsletter types
  - Natural language custom instructions field

**FR-14.2: Content Selection Interface**

- **Description:** Select evidence and sources for newsletter generation
- **Acceptance Criteria:**
  - **"Highly Rated News for This Week" View:**
    - Show community-curated content (score 5)
    - Show content from enterprise's custom sources
    - Filter by category, date range, topic
  - **Evidence Selection:**
    - Multi-select UI for picking supporting evidence
    - Mix community + private sources
    - Preview selected items before generation
  - **Source Selector:**
    - Choose which sources newsletter should reference
    - Community sources + enterprise custom sources
    - Toggle sources on/off

**FR-14.3: Newsletter Draft Generation**

- **Description:** One-click newsletter generation from configuration + selected evidence
- **Acceptance Criteria:**
  - **One-Click Generation:**
    - Click "Generate Draft" button
    - Agent synthesizes content based on config + selected evidence
    - Output formats: Markdown, Plain Text, HTML (user chooses)
    - Generation completes in under 5 minutes
  - **Draft Quality:**
    - 90%+ of generated drafts require only minor edits (not major rewrites)
    - Proper citations and evidence attribution
    - Coherent structure following selected template
    - Matches specified tone and audience level
  - **In-App Editor:**
    - Rich text editor for refinement
    - Markdown editing mode
    - Preview mode
    - Track changes/edits

**FR-14.4: Version History & A/B Testing**

- **Description:** Track draft versions for iterative refinement and A/B testing
- **Acceptance Criteria:**
  - Automatic versioning on each regeneration or manual save
  - Version history panel showing all previous drafts
  - Compare versions side-by-side
  - Restore previous version
  - Tag versions: "Draft 1 - Technical Focus", "Draft 2 - Business Focus"
  - Notes field per version for team collaboration

**FR-14.5: Email Distribution**

- **Description:** Send finished newsletters to email lists
- **Acceptance Criteria:**
  - Email list management (import, add, remove subscribers)
  - Send preview to test emails
  - Schedule send or send immediately
  - HTML email rendering from draft
  - Track send status (sent, failed, bounced)
  - Basic analytics: open rate, click rate (if Growth phase)
  - Integration with email service providers (SendGrid, Mailchimp, etc.)

**FR-14.6: Team Collaboration (Growth Phase)**

- **Description:** Multi-user editing and approval workflows for Enterprise teams
- **Acceptance Criteria:**
  - Role-based access: Writer, Editor, Approver
  - Comment threads on drafts
  - Approval workflow: Draft → Review → Approved → Scheduled
  - Notification system for workflow state changes
  - Activity log: who edited what and when

---
