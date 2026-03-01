# cherry-in-the-haystack - Product Requirements Document

**Author:** HK
**Date:** 2025-11-07
**Version:** 1.0

---

## Executive Summary

**cherry-in-the-haystack** evolves from a personal content curation tool into **Cherry for AI Engineers** — a living, community-driven knowledge base with personalized intelligence and content creation capabilities.

The product addresses the critical problem of fragmented, rapidly-changing LLM knowledge that overwhelms practitioners. Engineers, builders, and product teams currently rely on scattered Twitter posts, Discord chats, papers, repos, and blog updates that become outdated within weeks. There is no single, living source of truth that organizes this knowledge and helps people make practical decisions when building real AI products.

**Cherry for AI Engineers provides:**
- **Community-Curated Knowledge Base:** Continuously updated, structured map of what matters right now
- **Personalized Intelligence Platform:** Custom feeds and scoring based on individual needs
- **Adaptive Knowledge Base:** User-controlled topics with custom evidence and Writer Agent regeneration
- **Newsletter Studio (Enterprise):** AI-powered content creation from curated sources to polished newsletters in minutes
- Clear explanations, trade-offs, and practical examples
- Collective intelligence that compounds instead of fading
- Orientation in a chaotic, fast-moving landscape
- Living knowledge graph connecting concepts, evidence, and sources

**Product Evolution:**
- **Free Tier:** Full access to community-curated knowledge via web application with limited personalization(custom sources)
- **Paid Tiers:** More personalization; adaptive knowledge base
- **Enterprise Tier:** Newsletter Studio for marketing teams to create promotional content at scale

### What Makes This Special

**"Orientation in chaos through collective intelligence that compounds — personalized to your needs."**

This isn't just documentation — it's a living, community-curated knowledge platform that adapts to each user while being sustained by active practitioners. The magic happens at multiple levels:

> *"This isn't just information — it's the exact distillation of what I needed, at the right level, personalized to what matters to me, and always up-to-date."*

**The "Wow" Moments:**

**For Individual Practitioners (Free & Paid):**
- A founder reads "Choosing your embedding model" and instantly knows the trade-offs for their use case
- An engineer finds a clean, minimal reference architecture for retrieval or agent orchestration that just clicks
- A newcomer sees they can follow the map instead of drowning in noise
- **Personalized feed:** "My feed only shows what matters to me, scored exactly how I want"
- **Adaptive digest:** "My weekly digest and tech map only surfaces what's relevant to my work"
- **Custom knowledge base:** "I added my company's internal docs, and Cherry rewrote pages with my context"
- Users experience: **Clarity** ("Ah, now I understand"), **Confidence** ("I know which approach to choose"), and **Speed** ("I caught up in minutes, not days")

**For Enterprise Teams (Newsletter Studio):**
- A marketing team turns 100 curated sources into a polished promotional newsletter in 15 minutes instead of 4 hours
- Content teams A/B test different newsletter angles with version history
- Companies maintain consistent voice and quality across all external communications
- **The Enterprise Magic:** "We went from manual curation chaos to automated intelligence at scale"

---

## Project Classification

**Technical Type:** SaaS Platform (Web Application + API Backend + User Management)
**Domain:** EdTech / Knowledge Management / B2B SaaS
**Complexity:** High (expanded from Medium due to personalization engine, user management, and enterprise features)

### Architecture Evolution

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

## Success Criteria

Success means Cherry becomes the **most time-efficient way to stay sharp in the LLM world**, where people return naturally and recommend it enthusiastically — while scaling as a sustainable SaaS business with enterprise value.

### User Experience Success Metrics (Free & Paid Tiers)

**Clarity:** Users consistently report "Ah, now I finally understand"
- Measured by: User feedback, comprehension surveys, community testimonials

**Confidence:** Users know which approach to choose and why
- Measured by: Decision velocity, reduced follow-up questions, practical application reports

**Speed:** Users catch up on latest developments in minutes, not days
- Measured by: Time-to-insight metrics, return visit frequency, daily active users

**Practicality:** Users find actionable examples, architectures, prompts, benchmarks
- Measured by: Code snippet usage, reference architecture adoption, community implementations

**Personalization Value:** Paid users report significantly higher relevance and efficiency
- Measured by: Net Promoter Score (NPS) difference between free and paid tiers
- Target: NPS 60+ for paid users (vs 40+ for free users)
- Personalization accuracy: 85%+ of recommended content rated as "relevant" or "highly relevant"

### Community & Growth Metrics

- **Active Contributors:** 20+ team members (current baseline) growing to 50+ within 6 months
  - **Knowledge Team:** Structured subset responsible for weekly news review, monthly concept reviews, and study sessions
- **Content Freshness:** Critical sections updated within 1 week of major releases
- **User Engagement:**
  - Free Tier: 50,000 unique monthly visitors within 6 months
  - Paid Tier: 500 paying users within 6 months (1% conversion)
  - Enterprise Tier: 10 enterprise clients within 12 months
- **Community Impact:**
  - Recognized as go-to reference in AI engineering communities (Twitter, Discord, Reddit mentions)
  - Referenced in production codebases and technical blogs
  - Contributors include practitioners from leading AI companies

### SaaS Business Metrics

**Conversion & Retention:**
- Free → Paid conversion rate: 2-5% within 3 months of signup
- Paid user retention: 80% monthly retention (annual plans preferred)
- Enterprise retention: 90%+ annual renewal rate

**Engagement:**
- Daily active users (DAU): 20% of monthly active users
- Average session duration: 8+ minutes for paid users (vs 4+ minutes free)
- Personalization adoption: 70%+ of paid users configure custom sources within first week

**Newsletter Studio (Enterprise) Metrics:**
- Time savings: 75% reduction in newsletter creation time (4 hours → 1 hour or less)
- Newsletter quality: 85%+ customer satisfaction with generated drafts
- Usage frequency: Enterprise clients publish 2+ newsletters per month on average
- Feature adoption: 80%+ of enterprise clients actively use Newsletter Studio within first month

### Technical Quality Metrics

- **Content Quality:** AI-assisted curation maintains 90%+ approval rating from human reviewers
- **Knowledge Coverage:** MECE (Mutually Exclusive, Collectively Exhaustive) structure covers 95% of common LLM engineering decisions
- **Update Velocity:** New content ingested, reviewed, and published within 48 hours of submission
- **Newsletter Generation Quality:** 90%+ of generated drafts require only minor edits (not major rewrites)

---

## Product Scope

Cherry for AI Engineers is organized into three main content sections, each with distinct content pipelines and update mechanisms.

### Content Structure

#### 1. Basics Section
**Purpose:** Foundation concepts covered in established resources (O'Reilly/Packt/and other esteemed books & canonical lectures)

**Topics:**
- Prompting techniques and patterns
- Retrieval-Augmented Generation (RAG)
- Fine-tuning strategies
- Agent architectures
- Embeddings and vector databases
- Evaluation methodologies
- (and then more added by team)

**New Page Structure (Applied to ALL users - Free & Paid):**

Each concept page follows this four-section format:

1. **Overview**
   - Summarizes the definition of the technique/methodology
   - Explains why this matters to engineers
   - Provides context and practical relevance

2. **Cherries**
   - MECE-structured summaries of what ingested books and sources say about this concept
   - Each entry is a distinct, non-overlapping insight from an authoritative source
   - Organized so entries are collectively exhaustive — together they cover the concept fully
   - Shows the ground truth: what the literature actually says, not AI invention
   - Format: source title + structured key insight(s) from that source

3. **Child Concepts / Co-occurring Concepts**
   - Shows related concepts from Graph DB ontology
   - Displays prerequisite, related, subtopic, extends, or contradicts relationships
   - Example: RAG concept shows "Reranking", "Hybrid Search", "Vector Databases" as child concepts
   - Each related concept includes brief explanation of relationship

4. **Progressive References (MECE Learning Path)**
   - Mutually Exclusive, Collectively Exhaustive reference organization
   - Starts with foundational article that broadly and easily covers the concept
   - Each subsequent reference adds value not covered in previous ones
   - Clear progression: "Start here" → "Next, learn X" → "For deeper understanding, see Y"
   - Explains what unique value each reference provides
   - Format: Reference title + what it teaches + why it follows previous reference

**Content Pipeline:**
```
Curated Text Sources → Evidence Layer Storage → Ontology Building → Writer Agent Synthesis (new format) → Publication
```

**Content Promotion Flow:**
- New concepts emerge in **Advanced** section first
- Concepts with sustained importance (metric-based evaluation) promote to **Basics** section
- Monthly review cycle (2nd Saturday) for concept promotion decisions

**Update Strategy:** Continuously updated as new authoritative books or significant lectures emerge

#### 2. Advanced Section
**Purpose:** Deep technical content not suitable for beginners or general use

**Topics:** Same domains as Basics, but with advanced depth:
- Advanced prompting (chain-of-thought, constitutional AI)
- Multi-hop RAG, hybrid search
- PEFT, LoRA, QLoRA techniques
- Multi-agent orchestration
- Custom embedding models
- Adversarial evaluation, benchmarking

**Page Structure:** Same four-section format as Basics (Overview → Cherries → Child Concepts → Progressive References)

**Content Pipeline:** Same as Basics section (Evidence Layer → Ontology → Writer Agent with new format)

**Update Strategy:** Continuous updates from cutting-edge research and practitioner insights. New concepts appear here first before potential promotion to Basics.

#### 3. Newly Discovered Section
**Purpose:** Fresh, high-value content from the rapidly evolving LLM ecosystem

**Categories** (evolving taxonomy):

**1. Research & Models (연구·모델)**

Tracks foundational research, model releases, and evaluation resources.

**1a. Model Updates**
- New model releases and architectures (GPT-4.5, LLaMA3, Claude 4, etc.)
- Performance improvements and benchmarking results
- Version changes: model size, token limits, inference speed
- API updates: features, pricing, endpoints (function calling, embeddings)
- Protocol/auth changes (one-liner + external link)

**1b. Datasets / Papers / Benchmarks** (Curated links - not direct implementation)
- **Datasets:**
  - New public datasets (web crawling, domain-specific): name, scale, license
  - Dataset updates (e.g., latest Wikipedia dumps)
  - High-quality annotation/labeling service launches
- **Benchmarks:**
  - BIG-Bench, HELM, MMLU, and other benchmark latest results
  - Paper-based leaderboards (paperswithcode.com) major ranking changes
  - Open-source evaluation tools updates (Guardrails, LM-eval-harness)
- **Papers:** (External service connections - link out, don't directly curate)
  - NeurIPS, ICML, ACL, and other major conference papers
  - Spotlight sessions, workshop topics, presentation materials
  - Tutorial and panel discussion trends

**2. Service & System Building (서비스·시스템 구축)**

Tools and resources for building AI applications and systems.

**2a. Frameworks** (AI Development Programs)
- Development frameworks, SDKs, APIs
- Ecosystem landscape map (4-6 key tools, digest format)
- Link to comprehensive landscape: https://malywut.github.io/ai-engineering-landscape/
- Update cards: 1-2 line summaries of key changes
- Stable/Beta releases and deprecation notices
- Major dependency updates (Accelerate, PEFT, etc.)

**2b. Tools** (Programs that make AI developers' lives easier)
- Newly emerged developer tools
- Productivity enhancements for AI engineering
- "Our Mini Product Hunt" - curated tool directory
- **Hall of Fame:** Proven tools that enhance AI development

**2c. Shared Resources** (Community contributions)
- Shared prompts, templates, and prompt engineering patterns
- Code snippets and implementations
- Workflows and orchestration patterns
- MCP (Model Context Protocol) implementations
- Agent configurations and architectures

**3. Industry & Business Applications (산업·비즈니스 적용)** ⭐ (Priority)

Real-world implementations and business value.

**3a. Case Studies**
- Domain-specific use cases with architecture details
- Company product launches (chatbots, document automation, etc.)
- Conference presentations (e.g., Baemin's text-to-SQL implementation)
- ROI analysis and adoption strategies
- Success and failure stories with lessons learned
- VC funding & M&A trends in LLM space
- Productivity research results (3-line summary + references)

**4. Ecosystem, Governance, Knowledge Dissemination (생태계, 거버넌스, 지식 확산)**

AI community, policy, regulation, and thought leadership.

**4a. Regulations + Technical Reports** (Policy, regulation, and governance)
- EU AI Act, US FTC guidelines, domestic privacy law amendments
- Industry-specific AI regulations (healthcare, finance, etc.)
- Audit and risk assessment reports
- Standardization organization (ISO/IEC) publications
- Major court cases and legal precedents

**4b. Big Tech Trends**
- Major announcements from tech companies
- Strategic shifts and industry positioning
- Partnership and collaboration news

**4c. This Week's Posts** (AI development insights)
- Insightful articles on AI development practices
- Technical deep dives and architectural discussions
- Community best practices and lessons learned
- Emerging patterns and trends in AI engineering

**Content Pipeline:**
```
Content Ingestion Pipeline → Deduplication → AI Agent Scoring (1-5) → Knowledge Team Weekly Review → Graph DB Mapping → Direct Publish (NO synthesis)
```

**Knowledge Team Review Process (Weekly - Wednesday):**
1. Assigned team members review their allocated news items in Notion DB
2. Team validates and corrects:
   - Summary accuracy
   - Score (1-5 scale)
   - Relation to ontology graph (LLM-assisted mapping)
3. Status changed to "finished" when review complete
4. Top 20 items (score 5, sorted) flow to weekly newsletter generation

**Update Strategy:** Weekly batch approval and publication of top-rated content

**Personalization for Paid Users:**
- Paid users can **filter categories** they're not interested in (e.g., hide "Model Updates", show only "Business Cases")
- Custom filtering applies to "Newly Discovered" feed
- Free users see all community-curated news; paid users see filtered view based on preferences

---

### MVP - Minimum Viable Product

**Phase 1: Core SaaS Platform Launch**

**Infrastructure:**
- ✅ Content Ingestion Pipeline configured for LLM-focused sources (Twitter, Discord, GitHub, papers, blogs)
- ✅ Vector database & system operating at content level (pre-scoring)
- ✅ AI agent 1-5 scoring system integrated into Notion
- ✅ Notion-based Knowledge Team review workflow with weekly approval cycle
- ✅ Graph Database with two-layer architecture:
  - Ontology Layer: Concept nodes and relationships
  - Evidence Layer: Source texts and materials
- ✅ Writer Agent for Basics/Advanced page generation with **new four-section format** (Overview → Cherries → Child Concepts → Progressive References)
- **🆕 Web Application Backend:**
  - User authentication & authorization (email/password, OAuth)
  - User database (accounts, preferences, reading history)
  - RESTful API for content delivery
  - Cloud-hosted application (replaces GitHub Pages)
- **🆕 Frontend Web Application:**
  - Dynamic, responsive web app (replaces static Jupyter Book)
  - User dashboards (personalized vs unpersonalized views)
  - Content browsing and navigation
  - Search functionality

**Content at Launch:**
- **Basics Section:**
  - Topics extracted from Curated Books and Lectures
  - All pages use new four-section format
- **Advanced Section:**
  - Topics extracted from Curated Books and Lectures
  - All pages use new four-section format
- **Newly Discovered:**
  - All 4 main categories established with initial content (Research & Models, Service & System Building, Industry & Business Applications, Ecosystem/Governance)
  - Minimum 10 entries per category from first month of curation

**User Tiers (MVP Launch):**

**Platform Features (All Tiers):**
- **Multi-Language Support:**
  - UI available in multiple languages (English, Korean, and more)
  - User can select preferred interface language
  - Content remains in original language (community-curated in English by default)
  - Future: Machine translation for content (post-MVP enhancement)

**Free Tier (Unpersonalized Experience):**
- Access to all community-curated content
- Browse Basics, Advanced, Newly Discovered sections
- View content in new four-section format
- Built-in search
- No account required for read-only access
- Optional account creation for reading history

**Paid Tier (Personalized Experience):**
- **Custom Source Management:**
  - Add private sources (URLs, RSS feeds) beyond community-curated sources
  - Configure which community sources to follow
- **Natural Language Scoring Criteria:**
  - Define personal scoring preferences (e.g., "I care more about business cases than theory")
  - AI interprets natural language preferences into scoring weights
- **Personalized Content Feed:**
  - "Newly Discovered" filtered by user interests (hide categories, filter topics)
  - Personalized digest/patchnotes showing only relevant content
- **Custom Knowledge Base (User-Controlled Topics):**
  - Add new topics by submitting reference articles
  - User commands Writer Agent to regenerate pages with custom evidence
  - Adaptive knowledge base that rewrites when user changes preferences

**Enterprise Tier (Newsletter Studio):**
- Everything in Paid Tier, PLUS:
- **Newsletter Studio:**
  - **Prompt Configuration Panel:**
    - Configure tone (professional, casual, technical, etc.)
    - Define structure templates (intro → highlights → deep dive → conclusion, etc.)
    - Set audience level (beginner, intermediate, expert)
    - Customize focus areas (business, technical, research, etc.)
  - **Content Selection Interface:**
    - "Highly rated news for this week" (personalized to enterprise's sources)
    - Mix community-curated + private sources
    - Select specific evidence items as supporting references
  - **Draft Generation:**
    - One-click generation based on configuration + selected evidence
    - Output formats: Markdown, Plain Text, HTML (user chooses)
    - In-app editor for refinements
  - **Version History:**
    - Iterative refinement tracking
    - A/B test different angles/tones
    - Previous drafts accessible
  - **Email Distribution:**
    - Send finished newsletters to email lists
    - Integration with email service providers

**Contribution Workflow:**
- URL submission mechanism for community sources
- 20+ person team active (content + development contributors)
- **Knowledge Team** (subset of contributors):
  - Weekly review cycle (Wednesday) for news validation and ontology mapping
  - Monthly concept promotion meetings (2nd Saturday)
  - Wednesday study sessions for evidence layer seeding

**AI Capabilities:**
- Chunk-level (paragraph) deduplication and value assessment
- Automatic identification of unique, value-adding content vs noise
- AI-assisted quality scoring (1-5 scale)
- LLM-based ontology graph mapping (concept-to-news relationships)
- Writer Agent for page generation (new format):
  - Loads concept + connected concepts + relationships from Graph DB
  - Collects mapped evidence sources
  - Generates four-section structure: Overview → Cherries → Child Concepts → Progressive References
  - Composes pages by citing/paraphrasing evidence
- **🆕 Natural Language Preference Parsing:**
  - Interprets user's natural language scoring criteria into actionable weights
- **🆕 Personalization Engine:**
  - Content filtering based on user preferences
  - Custom scoring and feed ranking
- **🆕 Newsletter Generation Agent:**
  - Configurable tone, structure, audience, focus
  - Evidence synthesis from multiple sources
  - Draft generation in multiple formats

**What's NOT in MVP:**
- Recommendation engine (content and source recommendations)
- Adaptive learning path generation
- Smart notifications and email digests
- Reading analytics and progress tracking
- In-app editing for general contributors
- Commenting and discussion features
- Advanced analytics dashboard
- Mobile native apps (web-responsive only)
- API access for programmatic use
- Team collaboration features beyond Newsletter Studio
- All Phase 2 features (moved to Future Vision)

---

### Growth Features (Post-MVP)

**MVP focuses on Phase 1 features only. Phase 2 features moved to Future Vision.**

---

### Vision Features (Future)

**Phase 2: Enhanced User Experience** (Moved from Post-MVP)

**Advanced Personalization:**
- **Adaptive Learning Path Generation:**
  - AI generates personalized learning sequences based on user's current knowledge and goals
  - "Start here → Learn next" pathways customized to individual needs
- **Smart Notifications:**
  - "What's changed since last visit" summaries
  - Email digests for subscribed topics
  - Alert when new content published in user's interest areas
- **Reading Analytics:**
  - Personal dashboard showing reading progress
  - Time-to-mastery estimates for topics
  - Knowledge gap identification

**Recommendation Engine:**
- **Content Recommendations:**
  - Collaborative filtering: "Users like you also read..."
  - Content-based filtering: Based on reading history topics
  - Explicit preferences: User's natural language criteria + category filters
  - Recommendation panel on dashboard: "Recommended for You"
  - Explanation: "Recommended because you read [X] and prefer [Y]"
  - Feedback loop: User can mark recommendations as relevant/not relevant
  - Target: 85%+ rated "relevant" or "highly relevant"
- **Source Recommendations:**
  - Discover new channels/sources aligned with user interests
  - Analyze user's reading patterns and custom sources
  - Recommend community sources user isn't following
  - Recommend new public sources to add (blogs, Twitter accounts, RSS feeds)
  - "Try this source" suggestions with preview
  - One-click add recommended source to custom sources

**Enhanced Web Experience:**
- Bookmarking and personal reading lists
- Table of contents with progress tracking
- Dark mode and advanced reading preferences (font size, line spacing, etc.)
- Offline reading mode (PWA capabilities)
- Multi-device sync (read on desktop, continue on mobile)

**Community Features:**
- In-app editing for approved contributors
- Comment and discussion threads per page
- Contributor profiles and recognition
- Community voting on content priorities
- Suggested edits and improvement workflow
- Follow favorite contributors

**Content Intelligence Enhancements:**
- **Semantic search using embeddings** (upgrade from basic search)
- **Controversy Detection:**
  - Multi-source synthesis for controversial topics
  - Show different perspectives with evidence
  - Community voting on best explanations
- **Comparison Tools:**
  - Automatic comparison tables (e.g., "Embedding models compared")
  - Side-by-side tool/framework analysis
- **Timeline Visualization:**
  - Framework evolution over time
  - "What changed in LLM space this quarter" visualizations
- **Automated Changelogs:**
  - Track major topic updates
  - Highlight what changed and why

**Newsletter Studio Enhancements (Enterprise):**
- **Team Collaboration:**
  - Multi-user editing and approval workflows
  - Role-based access (writers, editors, approvers)
  - Comment threads on drafts
- **Advanced Templates:**
  - Industry-specific newsletter templates
  - Seasonal/event-based templates
  - Brand voice presets
- **Analytics:**
  - Newsletter performance metrics
  - A/B test results tracking
  - Audience engagement insights
- **Integration Ecosystem:**
  - CRM integrations (HubSpot, Salesforce)
  - Marketing automation platforms
  - Social media cross-posting

**Developer Tools:**
- Public API for content access
- Webhook integrations for content updates
- RSS feeds per category
- Markdown export functionality
- Embeddable widgets for external sites

**Analytics & Insights:**
- Most-read topics and trending sections
- Content gap analysis (what's missing)
- Community contribution metrics dashboard
- Impact tracking (references, citations, social shares)
- User engagement heatmaps

---

**"GitHub for Personal Knowledge Management"** (Long-term Vision)

**Personal Knowledge Repositories:**
- Users maintain their own private knowledge bases
- Fork and customize content to personal context
- Private notes and annotations layer over public content
- Personal taxonomy and organization preferences

**Knowledge Synchronization:**
- Cross-user "sync" mechanism powered by AI agents
- Discover when others update topics you're tracking
- Merge insights from multiple contributors
- Conflict resolution for diverging perspectives

**Collaborative Knowledge Graphs:**
- Visual knowledge maps showing concept relationships
- Community-built concept ontology
- Link discovery between disparate sources
- Exploration interface for knowledge navigation

**AI-Powered Personal Assistants:**
- Personal AI agent that understands your knowledge gaps
- Proactive recommendations based on your work context
- Automated synthesis of your reading into personal summaries
- Query interface: "What do I need to know about X for my project Y?"

**Advanced Synthesis:**
- Multi-perspective synthesis (academic vs practitioner vs business)
- Automatic contradiction detection and resolution proposals
- Temporal analysis: "How has thinking evolved on X?"
- Predictive insights: "What's likely to matter in 6 months?"

**Integration Ecosystem:**
- Notion, Obsidian, Roam integration for personal notes
- IDE plugins for in-context reference
- Slack/Discord bots for team knowledge sharing
- CI/CD integration for automated best practice checks

**Governance & Quality:**
- Reputation system for contributors
- Expert endorsements for critical content
- Peer review workflows with specialized tracks
- Conflict resolution mechanisms for contentious topics

---

## SaaS Platform + API Backend Specific Requirements

### MVP Architecture: Full-Stack Web Application

Cherry is now a **full-stack SaaS platform** with user management, personalization, and enterprise features. This architecture shift provides:
- Dynamic, personalized content delivery
- User authentication and authorization
- Custom preferences and adaptive knowledge base
- Enterprise content creation tools (Newsletter Studio)
- Scalable infrastructure for growth

### System Architecture

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

### Concept Page Structure (UI Design)

**Design Philosophy:** Four-section progressive learning structure with MECE organization throughout.

**Page Layout for Basics/Advanced Concepts (Applied to ALL users - Free & Paid):**

```
# [Concept Title]

## 1. Overview
**What is [Concept]?**
- 1-2 sentence definition
- Why this matters to engineers
- Context and practical relevance
- Real-world problem this solves

**When to use:**
- Situational guidance
- Use cases and anti-patterns

## 2. Cherries
MECE-structured key insights from ingested books and sources on this concept:

- **[Source Title A]** — [Distinct insight or framing this source provides]
- **[Source Title B]** — [Different angle or aspect not covered by A]
- **[Source Title C]** — [Further non-overlapping insight]

*(Each cherry is a valuable piece picked from the haystack of source material — non-overlapping, collectively exhaustive)*

## 3. Child Concepts / Co-occurring Concepts
These concepts are commonly used together or build upon [Concept]:

### Prerequisite Concepts
- **[Related Concept A]** — Brief description of relationship
  - Why it matters: [1-line explanation]
  - Link to concept page

- **[Related Concept B]** — Brief description of relationship
  - Why it matters: [1-line explanation]
  - Link to concept page

### Related Concepts (Co-occurring)
- **[Concept X]** — Often used together (e.g., RAG + Reranking)
- **[Concept Y]** — Alternative or complementary approach

### Subtopics (Child Concepts)
- **[Narrower Concept]** — Specific implementation or technique
- Links to detailed pages for each

### Extensions (Advanced)
- **[Advanced Concept]** — Building on this foundation
- Links to Advanced section

## 4. Progressive References (MECE Learning Path)

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

### Content Storage Architecture

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

### Automation & Deployment Requirements

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

### Web Application Architecture

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

### Hosting & Deployment

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

### Content Seeding Strategy

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

### Browser & Platform Support

**Supported Browsers:**
- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- Last 2 major versions
- No Internet Explorer support

**Mobile Support:**
- Responsive design (Jupyter Book default)
- Touch-friendly navigation
- Optimized for mobile reading experience

**Accessibility:**
- WCAG 2.1 AA compliance target
- Keyboard navigation
- Screen reader compatibility
- Semantic HTML structure
- Sufficient color contrast

---

## Functional Requirements

Organized by user-facing capabilities, each requirement connects to the core product value: **helping practitioners find clarity, confidence, and speed in the rapidly-evolving LLM landscape.**

### 1. Content Ingestion & Aggregation

**FR-1.1: Multi-Source Content Collection**
- **Description:** Automatically aggregate LLM-related content from diverse sources (Twitter, Discord, GitHub, papers, blogs, RSS feeds)
- **User Value:** Users get comprehensive coverage without manually monitoring dozens of channels
- **Acceptance Criteria:**
  - Content Ingestion Pipeline pulls from at least 10 configured sources
  - New content discovered within 24 hours of publication
  - Source metadata preserved (URL, date, author, platform)
  - Configurable source priorities and categories
- **Magic Thread:** 🌟 This is the foundation - comprehensive coverage enables the "wow" moment of discovering everything in one place

**FR-1.2: Intelligent Deduplication**
- **Description:** Identify and filter duplicate or redundant content before processing
- **User Value:** Users see unique insights, not the same news repeated 10 times
- **Acceptance Criteria:**
  - Content-level deduplication before scoring (exact matches, near-duplicates)
  - Chunk-level deduplication for Basics/Advanced synthesis (paragraph similarity)
  - 95%+ accuracy in identifying true duplicates
  - Preserve original source for merged duplicates
- **Domain Constraint:** Must run before AI scoring to reduce API costs

### 2. Content Quality Assessment

**FR-2.1: AI-Powered Content Scoring**
- **Description:** Automatically evaluate content relevance and quality on 1-5 scale
- **User Value:** Only high-quality, relevant content reaches users - the 80% noise is filtered out
- **Acceptance Criteria:**
  - AI agent scores content based on defined criteria (relevance, depth, novelty, practicality)
  - Score 5 = top-tier content worthy of inclusion
  - Scoring completes within 5 minutes of ingestion
  - Pattern-based learning improves scoring accuracy over time
- **Magic Thread:** 🌟 This delivers the "speed" promise - users trust the curation quality

**FR-2.2: Knowledge Team Review Workflow**
- **Description:** Structured weekly review and approval process managed by Knowledge Team in Notion
- **User Value:** Community wisdom and domain expertise ensures quality, not just AI judgment
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
- **User Value:** Users encounter fresh insights, not rehashed content
- **Acceptance Criteria:**
  - Chunk-level (paragraph) analysis for novelty
  - Comparison against vector database of existing content
  - "Unique" flag for truly novel information
  - Value score based on: novelty, depth, practical applicability, evidence quality

### 3. Knowledge Graph & Database Management

**FR-3.1: Graph Database Two-Layer Architecture**
- **Description:** Concept-centric knowledge system with stable ontology and dynamic evidence
- **User Value:** Structured knowledge enables intelligent synthesis, relationship discovery, and evidence traceability
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

- **Magic Thread:** 🌟 The concept-centric graph makes knowledge reusable and evidence traceable

**FR-3.2: Ontology Extraction & Concept Discovery**
- **Description:** Monthly extraction of new concept noun phrases from evidence layer
- **User Value:** Cherry stays current with emerging LLM concepts and techniques
- **Acceptance Criteria:**
  - Monthly batch job (2nd Saturday) extracts new concept candidates from evidence layer
  - Word count and frequency metrics filter noise vs meaningful concepts
  - LLM-assisted concept relationship detection
  - Concept candidates presented to Knowledge Team for review
  - Approved concepts added to Ontology Layer with initial relationships
  - New concepts default to Advanced section (promotion to Basics based on sustained importance)

**FR-3.3: Evidence Collection & Study Sessions**
- **Description:** Knowledge Team study sessions populate Evidence Layer with curated texts
- **User Value:** High-quality source materials ensure accuracy and depth
- **Acceptance Criteria:**
  - Wednesday study sessions review texts (books, papers, documentation)
  - Reviewed texts stored in Evidence Layer with metadata (source, date, topic, quality)
  - Text chunking for efficient storage and retrieval
  - Evidence tagged with relevant concept associations
  - Study session notes captured for context

### 4. AI Synthesis & Knowledge Structuring

**FR-4.1: MECE Knowledge Organization**
- **Description:** Structure content into Mutually Exclusive, Collectively Exhaustive taxonomy
- **User Value:** Users can navigate logically without gaps or overlaps - delivers the "clarity" promise
- **Acceptance Criteria:**
  - 3 main sections: Basics, Advanced, Newly Discovered
  - 2-level hierarchy: parent concepts → child implementations
  - No concept should fit in multiple categories
  - All LLM engineering topics covered (95% coverage target)
  - Taxonomy evolves based on emerging topics
- **Magic Thread:** 🌟 This is the "orientation in chaos" - the structured map that makes users say "now I understand"

**FR-4.2: Writer Agent for Page Generation**
- **Description:** AI agent generates Basics/Advanced pages from knowledge graph using structured schemas
- **User Value:** Users get distilled, well-structured knowledge from multiple evidence sources with full traceability
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
- **Magic Thread:** 🌟 Writer agent transforms fragmented evidence into coherent, traceable knowledge

**FR-4.3: Concept Promotion Flow (Advanced → Basics)**
- **Description:** Promote concepts from Advanced to Basics based on sustained importance
- **User Value:** Basics section reflects truly foundational concepts, not just trendy topics
- **Acceptance Criteria:**
  - New concepts default to Advanced section
  - Metric-based evaluation tracks concept importance over time (mentions, usage, stability)
  - Monthly Knowledge Team review (2nd Saturday) evaluates promotion candidates
  - Promoted concepts move from Advanced → Basics with page updates
  - Promotion decisions documented with rationale

**FR-4.4: Evolving Taxonomy Management**
- **Description:** Continuously update content categories as LLM field evolves
- **User Value:** Cherry stays current with emerging topics and techniques
- **Acceptance Criteria:**
  - New categories can be added without restructuring
  - Content can be reassigned when taxonomy changes
  - Category deprecation with content migration plan
  - "Newly Discovered" categories reviewed quarterly for relevance

### 5. Content Publishing & Distribution

**FR-5.1: Automated Publication Pipeline**
- **Description:** Approved content automatically flows from Notion → Public site
- **User Value:** Fresh content reaches users within hours, not days - delivers the "speed" promise
- **Acceptance Criteria:**
  - Weekly batch: Notion → Cherry app update (markdown files)
  - Zero-downtime deployments
  - Rollback capability for broken builds
- **Magic Thread:** 🌟 Weekly updates keep Cherry feeling "alive"

**FR-5.2: Structured Content Display**
- **Description:** Cherry renders content with professional layout and navigation
- **User Value:** Users can read, navigate, and search efficiently
- **Acceptance Criteria:**
  - 3-section navigation (Basics, Advanced, Newly Discovered)
  - 2-level TOC with parent-child hierarchy
  - Built-in search functionality
  - Mobile-responsive design
  - Syntax highlighting for code
  - "Last updated" timestamps
  - Breadcrumb navigation

### 6. Content Contribution & Collaboration

**FR-6.1: URL Submission for Sources**
- **Description:** Community submits URLs for Content Ingestion Pipeline to monitor
- **User Value:** Crowdsourced source discovery expands coverage
- **Acceptance Criteria:**
  - Simple form/interface for URL submission
  - Validation: URL format, domain reachability
  - Queue for maintainer review
  - Approved URLs added to Content Ingestion Pipeline source list
  - Feedback to submitter (approved/rejected/reason)

### 7. Content Source Management

**FR-7.1: Content Source Configuration**
- **Description:** Manage which sources Content Ingestion Pipeline monitors for "Newly Discovered"
- **User Value:** Focused on LLM-specific sources, not generic tech news
- **Acceptance Criteria:**
  - Configuration file lists: source URL, category mapping, polling frequency
  - Sources include: Twitter accounts, Discord channels, GitHub orgs, RSS feeds, blogs
  - Per-source enable/disable toggle
  - Source health monitoring (last successful pull, error rate)

**FR-7.2: Curated Text Management for Basics/Advanced**
- **Description:** Manage library of curated sources (books, papers, canonical posts)
- **User Value:** Authoritative, high-quality foundation content
- **Acceptance Criteria:**
  - Document registry: source metadata (title, author, URL, PDF, publication date)
  - Extraction pipeline: PDF → text, web → markdown
  - Version tracking for updated sources
  - Source prioritization (canonical vs supplementary)

### 8. Quality Control & Moderation

**FR-8.1: Content Correction & Updates**
- **Description:** Fix errors, update outdated information, improve clarity
- **User Value:** Cherry remains accurate and trustworthy over time
- **Acceptance Criteria:**
  - Error reporting mechanism (GitHub issues)
  - Fast-track corrections for critical errors
  - "Last updated" dates show freshness
  - Changelog for major page updates
  - Deprecated content marked clearly with alternatives

### 9. Vector Database & Semantic Search (Backend)

**FR-9.1: Vector Storage for Deduplication**
- **Description:** Store embeddings of all unique content chunks
- **User Value:** Enables intelligent deduplication and similarity detection
- **Acceptance Criteria:**
  - Embeddings generated for all approved content
  - Vector database indexes: source, category, date, topic
  - Similarity search: cosine similarity threshold for duplicates
  - Efficient querying (under 100ms for similarity check)

### 10. User Management & Authentication

**FR-10.1: User Registration & Login**
- **Description:** Secure user account creation and authentication system
- **User Value:** Access to personalized features and tier-based capabilities
- **Acceptance Criteria:**
  - Email/password registration with email verification
  - OAuth login (Google, GitHub)
  - Password reset flow
  - JWT-based session management
  - Secure password hashing (bcrypt/argon2)
  - Account email change with verification

**FR-10.2: User Tier Management**
- **Description:** Support Free, Paid, and Enterprise tiers with appropriate feature access
- **User Value:** Clear value differentiation and upgrade paths
- **Acceptance Criteria:**
  - Free tier: Access to all community content (no account required for read-only)
  - Paid tier: Personalization, custom sources, adaptive KB
  - Enterprise tier: Everything in Paid + Newsletter Studio
  - Tier-based feature gating in UI and API
  - Upgrade/downgrade flows with proration
  - Billing integration (Stripe or similar)

**FR-10.3: User Profile Management**
- **Description:** Users can manage their account settings and preferences
- **User Value:** Control over personal information and experience
- **Acceptance Criteria:**
  - Profile page: name, email, tier, join date
  - Preference management (separate from personalization settings)
  - Account deletion (GDPR compliance)
  - Export user data (GDPR compliance)
  - Reading history view (paid users)

### 11. Personalization Engine

**FR-11.1: Custom Source Management**
- **Description:** Users can add private sources beyond community-curated content
- **User Value:** "My feed includes sources unique to my work and interests"
- **Acceptance Criteria:**
  - Add/remove custom source URLs (RSS, Twitter, blogs, etc.)
  - Toggle which community sources to follow
  - Source validation (reachable, valid format)
  - Content Ingestion Pipeline ingests user's custom sources
  - Content from custom sources only visible to that user
  - Source management UI with active/inactive status
- **Magic Thread:** 🌟 Custom sources enable truly personalized intelligence

**FR-11.2: Natural Language Scoring Criteria (Paid Tier)**
- **Description:** Users define scoring preferences in natural language, AI interprets into weights
- **User Value:** "I care more about business cases than theory, and Cherry knows that"
- **Acceptance Criteria:**
  - Input field for natural language criteria (e.g., "I care more about business cases than model updates")
  - AI parses criteria and generates scoring weights
  - Confirmation UI showing interpreted weights
  - User can refine and iterate
  - Scoring applies to feed ranking and content prioritization
  - Default community scoring for users who don't customize
- **Magic Thread:** 🌟 Natural language configuration makes personalization accessible

**FR-11.3: Content Filtering & Feed Personalization (Paid Tier)**
- **Description:** Paid users filter "Newly Discovered" by category and interest
- **User Value:** "My feed only shows what matters to me"
- **Acceptance Criteria:**
  - Filter "Newly Discovered" by category (hide Model Updates, show Business Cases, etc.)
  - Filter by topic keywords
  - Personalized digest/patchnotes showing only relevant content
  - Free users see all content; paid users see filtered view
  - Filters persist across sessions
  - Easy toggle between "All content" and "My filter"

**FR-11.4: Adaptive Content Scoring**
- **Description:** Apply user's custom scoring criteria to content ranking
- **User Value:** "Content scored exactly how I want - practicality over theory"
- **Acceptance Criteria:**
  - User-defined scoring weights applied to all content
  - Re-ranking of "Newly Discovered" feed based on user criteria
  - Score explanations: "This scored high because of your preference for X"
  - A/B comparison: community score vs personal score

### 12. Custom Knowledge Base (Adaptive KB) - Paid Tier

**FR-12.1: User-Controlled Topic Addition**
- **Description:** Paid users can add custom topics with reference articles
- **User Value:** "I added my company's internal RAG approach, and Cherry created a page for it"
- **Acceptance Criteria:**
  - UI for adding new topics (not in community KB)
  - Upload or link reference articles/evidence
  - Topic name, category (Basics/Advanced), and description
  - Evidence extraction from user-provided references
  - Store in user-specific evidence layer linked to Graph DB
  - User's custom topics visible only to them

**FR-12.2: Writer Agent Regeneration for Custom Topics**
- **Description:** Users command Writer Agent to generate pages for their custom topics
- **User Value:** "My knowledge base adapts to my context on-demand"
- **Acceptance Criteria:**
  - User clicks "Generate Page" for custom topic
  - Writer Agent loads user's custom evidence
  - Generates page in four-section format (Overview → Cherries → Child Concepts → Progressive References)
  - Page saved in user's personal knowledge base
  - Regeneration takes under 10 minutes
  - User can iterate: add more evidence → regenerate
- **Magic Thread:** 🌟 Adaptive knowledge base rewrites itself based on user's needs

**FR-12.3: User Knowledge Base Management**
- **Description:** Manage custom topics and personal knowledge base
- **User Value:** "Control what's in my personalized knowledge base"
- **Acceptance Criteria:**
  - View all custom topics (list view)
  - Edit/delete custom topics
  - Add/remove/edit reference articles for topics
  - Trigger regeneration after changes
  - Export personal KB to markdown
  - Distinction between community content and personal custom content

### 13. Internationalization & Multi-Language Support

**FR-13.1: Multi-Language UI**
- **Description:** Platform interface available in multiple languages for global accessibility
- **User Value:** "I can use Cherry in my native language, making it more accessible and comfortable"
- **Acceptance Criteria:**
  - **Initial Languages:** English (primary), Korean
  - Language selector in user settings and header
  - All UI elements translated: navigation, buttons, labels, form fields, error messages
  - User language preference saved (logged-in users)
  - Browser language detection for non-logged-in users (fallback to English)
  - RTL (Right-to-Left) layout support for future languages (Arabic, Hebrew)
  - Translation files: JSON-based i18n format (e.g., i18next)
  - Easy addition of new languages (modular translation files)

**FR-13.2: Content Language Handling**
- **Description:** Clear distinction between UI language and content language
- **User Value:** "I can use the interface in Korean while reading English content"
- **Acceptance Criteria:**
  - **MVP:** Content remains in original language (community-curated in English by default)
  - Language indicator on content pages (e.g., "Content in English")
  - User can filter content by language (future enhancement)
  - **Post-MVP:** Machine translation option for content (powered by AI)
  - Translation quality disclaimer when showing machine-translated content

**FR-13.3: Internationalization Infrastructure**
- **Description:** Technical foundation for multi-language support
- **User Value:** Scalable i18n system that supports adding new languages easily
- **Acceptance Criteria:**
  - i18n library integrated (e.g., i18next, react-intl, vue-i18n)
  - Pluralization rules for different languages
  - Date/time formatting per locale (e.g., MM/DD/YYYY vs DD/MM/YYYY)
  - Number formatting per locale (e.g., 1,000.50 vs 1.000,50)
  - Currency formatting (if applicable in future)
  - Translation management workflow (how team updates translations)
  - Translation coverage monitoring (ensure all UI strings translated)

### 14. Newsletter Studio - Enterprise Tier

**FR-14.1: Newsletter Agent Configuration**
- **Description:** Enterprise users configure newsletter generation agent with custom parameters
- **User Value:** "Our newsletter always matches our brand voice and target audience"
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
- **User Value:** "I pick the best stories from 100 sources, agent writes the newsletter"
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
- **User Value:** "15 minutes from curation to polished draft"
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
- **User Value:** "Test different angles and see what resonates"
- **Acceptance Criteria:**
  - Automatic versioning on each regeneration or manual save
  - Version history panel showing all previous drafts
  - Compare versions side-by-side
  - Restore previous version
  - Tag versions: "Draft 1 - Technical Focus", "Draft 2 - Business Focus"
  - Notes field per version for team collaboration

**FR-14.5: Email Distribution**
- **Description:** Send finished newsletters to email lists
- **User Value:** "From curation to inbox in one workflow"
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
- **User Value:** "Writers draft, editors refine, managers approve - all in one place"
- **Acceptance Criteria:**
  - Role-based access: Writer, Editor, Approver
  - Comment threads on drafts
  - Approval workflow: Draft → Review → Approved → Scheduled
  - Notification system for workflow state changes
  - Activity log: who edited what and when

---

## Acceptance Criteria Summary

**MVP Launch Readiness (SaaS Platform):**

**Infrastructure:**
- ✅ Content Ingestion Pipeline operational (ingestion → review → publish to database)
- ✅ Web application deployed on cloud infrastructure with custom domain
- ✅ User authentication and authorization functional (email/password + OAuth)
- ✅ Database architecture operational (PostgreSQL + Graph DB + Vector DB)
- ✅ API backend serving content dynamically
- ✅ Tier-based feature gating working (Free, Paid, Enterprise)
- ✅ Multi-language support: UI available in English and Korean (minimum)

**Content:**
- ✅ Community content pipeline operational (community-curated Basics, Advanced, Newly Discovered)
- ✅ Content stored in database with new four-section format (Overview → Cherries → Child Concepts → Progressive References)
- ✅ Content freshness: at least one "Newly Discovered" update per week

**Free Tier:**
- ✅ Users can browse all community-curated content without account
- ✅ Optional account creation for reading history
- ✅ Search functionality operational
- ✅ Custom source management functional (add/remove private sources)

**Paid Tier:**
- ✅ Natural language scoring criteria parser operational
- ✅ Content filtering and personalized feed working
- ✅ Custom knowledge base: users can add topics and command Writer Agent regeneration

**Enterprise Tier:**
- ✅ Newsletter Studio fully functional:
  - Prompt configuration panel
  - Content selection interface
  - Draft generation (Markdown, Plain Text, HTML)
  - In-app editor
  - Version history
  - Email distribution
- ✅ Time savings validated: 75%+ reduction in newsletter creation time
- ✅ Newsletter quality: 90%+ require only minor edits

---

## Non-Functional Requirements

These quality attributes ensure Cherry delivers on its promise of being the **most time-efficient way to stay sharp in the LLM world.**

### Performance

**Why it matters for THIS product:** Speed is one of the three core value promises. Users must be able to "catch up in minutes, not days."

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
- Deduplication check: under 100ms per item (vector similarity)
- Writer Agent page generation: under 10 minutes per concept
- Database writes: batch operations for efficiency

**NFR-P5: Personalization Performance**
- Natural language criteria parsing: under 3 seconds
- Personalized feed generation: under 2 seconds
- Custom source ingestion: added to pipeline within 1 hour
- User preference updates: reflected immediately (no cache delay)

**NFR-P6: Newsletter Studio Performance**
- Newsletter draft generation: under 5 minutes
- Version save: under 1 second
- Email send: queued immediately, sent within 5 minutes
- Large email lists (10,000+ subscribers): complete send within 30 minutes

**NFR-P4: API Rate Limiting Compliance**
- Respect LLM provider rate limits (OpenAI, Gemini, Ollama)
- Exponential backoff for transient failures
- Queue management for batch processing
- Cost optimization through caching and deduplication

### Scalability

**Why it matters for THIS product:** Content and user base expected to grow 5x within 6 months. Platform must scale gracefully.

**NFR-S1: Content Volume Scaling**
- Support 1,000+ pages without performance degradation
- **Graph DB** handles 10,000+ concept nodes with 100,000+ relationships efficiently
- Vector database handles 100,000+ embedded chunks efficiently (deduplication only)
- Database handles millions of content records with efficient indexing

**NFR-S2: User Scaling**
- Handle 50,000 monthly active users (MAU)
- Support 500 concurrent paid users without degradation
- 50+ enterprise clients with separate newsletter workspaces
- Database connection pooling for efficiency
- Horizontal scaling for web servers (auto-scale based on load)

**NFR-S3: Traffic Scaling**
- Handle 500,000+ page views per month
- CDN handles traffic spikes (e.g., viral social posts)
- Concurrent user capacity: 1,000+ simultaneous users
- Auto-scaling infrastructure responds to load within 2 minutes
- API rate limiting per user tier to prevent abuse

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

### Reliability & Availability

**Why it matters for THIS product:** Users must trust Cherry as a dependable reference. "Living knowledge base" requires consistent updates.

**NFR-R1: Application Uptime & Availability**
- 99.5% uptime target for web application (SLA for paid/enterprise tiers)
- 99.9% uptime for enterprise tier (higher SLA)
- Zero-downtime deployments (blue-green or rolling updates)
- Graceful degradation: read-only mode if write operations fail
- Automated health checks and monitoring (API endpoints, database connections)
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
- **Graph DB backups:** daily with 60-day retention
- Vector database backups: weekly with 60-day retention
- Git history serves as content version control

**NFR-R4: Error Recovery**
- Automated retry with exponential backoff for transient failures
- Dead-letter queue for permanently failed items
- Manual intervention workflow for critical failures
- Rollback capability for bad deployments (git revert)

### Security

**Why it matters for THIS product:** Protect API credentials and maintain trust. Public site is read-only, reducing attack surface.

**NFR-SEC1: Credential Management**
- API keys stored in environment variables (not in code)
- GitHub Secrets for sensitive credentials in Actions
- Notion API tokens rotated quarterly
- LLM provider API keys with minimal required permissions
- Postgres credentials use strong passwords with limited access

**NFR-SEC2: Input Validation**
- URL submissions validated (format, domain, reachability)
- Markdown content sanitized to prevent XSS
- File uploads restricted (if implemented in future)
- Rate limiting on URL submission form (prevent spam)

**NFR-SEC3: Dependency Security**
- Automated dependency scanning (Dependabot, Snyk)
- Quarterly security updates for critical dependencies
- No known high-severity CVEs in production dependencies
- Python packages from trusted sources (PyPI)

**NFR-SEC4: User Authentication & Session Security**
- Secure password storage using bcrypt or argon2 (industry standard hashing)
- JWT tokens for session management with appropriate expiration
- OAuth2 implementation for third-party authentication (Google, GitHub)
- Password reset tokens expire after 24 hours
- Session invalidation on logout
- Multi-device session management
- Account lockout after 5 failed login attempts

**NFR-SEC5: Data Privacy & GDPR Compliance**
- **Personal Data Collection:** Email, name, reading history, preferences, custom sources
- **Purpose:** Account management, personalization, service delivery
- **User Rights:**
  - Right to access: Users can download all their data
  - Right to deletion: Account deletion removes all personal data (except required for legal/billing)
  - Right to portability: Export data in JSON format
  - Right to opt-out: Disable reading history tracking
- **Data Retention:**
  - Active accounts: data retained indefinitely
  - Deleted accounts: personal data purged within 30 days
  - Billing records: retained per tax law requirements (7 years)
- **Third-Party Data Sharing:**
  - No selling of user data
  - Third-party processors: Email service providers, payment processors (Stripe)
  - Data processing agreements (DPA) with all processors
- **Encryption:**
  - Data in transit: TLS 1.3
  - Data at rest: Database encryption enabled
  - Passwords: Never stored in plaintext
- **Privacy Policy:** Clear, accessible privacy policy published
- **Cookie Policy:** Cookie consent for analytics (if implemented)
- **Compliance:** GDPR (EU), CCPA (California), PIPEDA (Canada)

**NFR-SEC6: Enterprise Data Isolation**
- Enterprise client data isolated (multi-tenancy security)
- Custom sources visible only to owning user/enterprise
- Newsletter drafts private to enterprise workspace
- No cross-enterprise data leakage
- Audit logs for enterprise actions

### Accessibility

**Why it matters for THIS product:** As educational infrastructure for global community, must be accessible to all builders regardless of ability.

**NFR-A1: WCAG 2.1 AA Compliance**
- Keyboard navigation for all interactive elements
- Screen reader compatibility (semantic HTML, ARIA labels)
- Sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
- Alt text for all meaningful images
- Captions or transcripts for video content (if added)

**NFR-A2: Responsive Design**
- Mobile-friendly layout (Jupyter Book default)
- Touch targets minimum 44x44 pixels
- Text reflows without horizontal scrolling
- Font size user-adjustable via browser settings

**NFR-A3: Content Readability**
- Plain language where possible (technical terms explained)
- Hierarchical heading structure (H1 → H2 → H3)
- Lists for scannable content
- Code blocks with syntax highlighting
- Avoid jargon without definitions

### Integration

**Why it matters for THIS product:** Multiple systems must work together seamlessly for the automated pipeline to function.

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
- **Note:** Vector DB used only for deduplication (Graph DB is primary knowledge store)

**NFR-I6: Multi-LLM Provider Support**
- Graceful fallback between OpenAI, Gemini, Ollama
- Configuration-driven provider selection
- Cost tracking per provider
- Consistent output format across providers

### Maintainability

**Why it matters for THIS product:** 20+ contributors need clear, well-organized codebase to collaborate effectively.

**NFR-M1: Code Quality**
- Python code follows PEP 8 style guide
- Type hints for function signatures
- Comprehensive docstrings for public APIs
- Linting enforced in CI/CD (flake8, black)
- Unit test coverage target: 70%+

**NFR-M2: Documentation**
- README files in all major directories
- Architecture documentation (this PRD + technical docs)
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
- Manual testing checklist for Jupyter Book deployments
- Test data fixtures for reproducible testing

### Data Quality & Freshness

**Why it matters for THIS product:** "Living knowledge base" promise requires continuous, high-quality updates.

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

---

## References

- **Project Overview:** .\docs\project-overview.md
- **Architecture Documentation:** .\docs\architecture-api.md
- **Content Ingestion Pipeline Documentation:** (Internal system documentation)

---

## Next Steps

**Immediate Next Step: Epic & Story Breakdown**

Run: `/bmad:bmm:workflows:create-epics-and-stories`

This workflow will:
1. Load this PRD automatically
2. Transform requirements into implementable epics
3. Create bite-sized stories (optimized for 200k context dev agents)
4. Organize by delivery phases

**Subsequent Steps:**

2. **UX Design** (if needed for custom Jupyter Book styling)
   - Run: `/bmad:bmm:workflows:create-ux-design`
   - Focus on card layouts, collapsible sections, branding

3. **Architecture Review**
   - Run: `/bmad:bmm:workflows:architecture`
   - Validate technical decisions for Content Ingestion Pipeline integration
   - Document integration points and data flows

4. **Implementation**
   - Follow BMM Phase 4 sprint planning
   - Execute stories with `/bmad:bmm:workflows:dev-story`

---

## Product Magic Summary

**Cherry for AI Engineers delivers "orientation in chaos through personalized intelligence" across three tiers:**

### For All Users (Community Foundation)

🌟 **Comprehensive Coverage** - Content Ingestion Pipeline aggregates from 50+ sources so users don't have to monitor dozens of channels

🌟 **Intelligent Curation** - AI scoring + Knowledge Team review filters 80% noise, surfacing only top-tier insights

🌟 **MECE Knowledge Structure** - Logical navigation without gaps or overlaps makes users say "now I understand"

🌟 **Progressive Learning** - New four-section format (Overview → Cherries → Child Concepts → Progressive References) guides efficient learning

🌟 **Living Updates** - Weekly "Newly Discovered" content keeps Cherry feeling alive and current

🌟 **Community Intelligence** - 50+ contributors make collective knowledge compound instead of fade

### For Paid Users (Personalized Experience)

🌟 **"My Feed Only Shows What Matters to Me"** - Custom sources, natural language scoring, filtered categories

🌟 **Adaptive Knowledge Base** - Add custom topics, Cherry rewrites pages with your evidence on command

🌟 **Personalization at Scale** - Natural language preferences instantly applied to all content

### For Enterprise Teams (Content Creation at Scale)

🌟 **Newsletter Studio** - "100 sources → polished newsletter in 15 minutes"

🌟 **75% Time Savings** - From 4 hours of manual curation to 1 hour with AI assistance

🌟 **Configurable Voice** - Tone, structure, audience, focus - all customizable

🌟 **A/B Testing Built-In** - Version history for iterative refinement and angle testing

---

**The "wow" moments:**

**Individual Practitioners:**
- "This isn't just information — it's exactly what I needed, at my level, personalized to what matters to me"
- "I added my company's internal docs, and Cherry rewrote my knowledge base with my context"
- "My digest only shows what's relevant — no more noise"

**Enterprise Teams:**
- "We turned 100 curated sources into a polished newsletter in 15 minutes instead of 4 hours"
- "Our marketing team now publishes 2x more newsletters with consistent quality"

---

**Current Scope:** Community-curated knowledge base + Personalized intelligence platform + Enterprise content creation studio

**Future vision:** Evolves into "GitHub for Personal Knowledge Management" where everyone maintains knowledge repos and syncs with the community through AI-powered collaboration.

---

_This PRD captures the essence of cherry-in-the-haystack's transformation from personal curation tool into a multi-tier SaaS platform serving AI builders worldwide._

_Created through collaborative discovery between HK and AI facilitator using BMad Method._

_Original Date: 2025-11-07 | Expanded: 2026-02-24_

