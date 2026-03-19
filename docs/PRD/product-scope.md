# Product Scope

Cherry for AI Engineers is organized into three main content sections, each with distinct content pipelines and update mechanisms.

## Content Structure

### 1. Basics Section

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

### 2. Advanced Section

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

### 3. Newly Discovered Section

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

- **Entity follow:** Follow specific models, frameworks, tools, and other tracked entities from the registry; assign weights to control ranking prominence
- **Category filtering:** Show/hide entire category groups (e.g., hide "Model Updates", show only "Business Cases"); assign per-category weights
- Personalized Newly Discovered pages are filtered + reranked article lists — same structure as community pages, no synthesis
- Community page shown as fallback for categories with no preference configured
- Free users see full community-curated content; paid users see filtered/reranked view with a "Community | For You" toggle per category page

---

## MVP - Minimum Viable Product

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

## Growth Features (Post-MVP)

**MVP focuses on Phase 1 features only. Phase 2 features moved to Future Vision.**

---

## Vision Features (Future)

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
