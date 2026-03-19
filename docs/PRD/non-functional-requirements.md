# Non-Functional Requirements

These quality attributes ensure Cherry delivers on its promise of being the **most time-efficient way to stay sharp in the LLM world.**

## Performance

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

## Scalability

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

## Reliability & Availability

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

## Security

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

## Accessibility

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

## Integration

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

## Maintainability

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

## Data Quality & Freshness

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
