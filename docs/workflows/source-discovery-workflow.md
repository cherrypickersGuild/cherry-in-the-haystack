# Source Discovery Workflow (Human-in-the-Loop)

## Overview

A semi-automated workflow for discovering, evaluating, and adding new content sources to the system. The agent handles discovery and initial scoring, while humans make final approval decisions.

**Current Focus: Substack-only discovery**

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Substack       │ --> │  Staging         │ --> │  Notion Review  │
│  Search         │     │  (Notion DB)     │     │  (Manual)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                        ┌──────────────────┐           │
                        │  Sources DB      │ <─────────┘
                        │  (Approved)      │    Approved
                        └──────────────────┘
```

## Notion Databases

- **Candidates DB:** [Source Candidates](https://www.notion.so/33bf199edf7c81f8b10ec7fc174aa267)
- **Parent Page:** [Data Sources](https://www.notion.so/Data-Sources-1f4f199edf7c8033bab4c9f7873ff69b)

---

## Workflow Stages

### Stage 1: Discovery (Automated)

**Trigger:**
- Scheduled (daily/weekly)
- Manual: `/discover-sources --topic "AI safety" --type RSS`
- Keyword-based: Monitor mentions of new sources

**Agent Actions:**
1. **Search** for candidate sources
   - Web search for "[topic] RSS feed", "[topic] newsletter", "[topic] blog"
   - YouTube channel discovery via search API
   - Twitter/X account discovery via search
   - Reddit subreddit discovery via related communities

2. **Enrich** each candidate with metadata
   - Fetch RSS feed validity (for RSS)
   - Get channel stats (for YouTube)
   - Get follower count/posting frequency (for Twitter)
   - Get subscriber count/activity level (for Reddit)

3. **Initial Scoring** (automated heuristics)
   ```
   Score 1-5 based on:
   - Content relevance to topics (2 pts max)
   - Posting frequency consistency (1 pt)
   - Authority/credibility signals (1 pt)
   - Community engagement (1 pt)
   ```

4. **Filter** by minimum threshold
   - Only candidates with score >= 3 proceed to staging
   - Candidates with score >= 4 are flagged as "high priority"

**Output:** List of candidates with metadata → Staging Queue

---

### Stage 2: Staging (Notion Queue)

**Storage:** Notion "Source Candidates" database (separate from "Sources")

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Source name |
| URL | URL | Source URL/feed |
| Type | Select | RSS / TWITTER / YOUTUBE / REDDIT / BLOG |
| Status | Select | New / Under Review / Approved / Rejected |
| Auto Score | Number | Agent's initial score (1-5) |
| Priority | Select | High / Medium / Low |
| Topic Tags | Multi-select | AI Safety, ML Research, etc. |
| Reason | Rich Text | Why this source was suggested |
| Metadata | Rich Text | JSON: subscriber count, frequency, etc. |
| Discovered | Date | When discovered |
| Reviewed By | Person | Who reviewed (if applicable) |
| Review Notes | Rich Text | Human notes |
| Final Score | Select | Human's final score (1-5) |

**Initial Status:** All new candidates start as "New"

---

### Stage 3: Human Review (Manual)

**Interface Options:**

1. **Notion Dashboard** (Simplest)
   - Review candidates in Notion "Source Candidates" database
   - Update Status, Final Score, Review Notes
   - Approved → triggers sync to "Sources" database

2. **CLI Review** (Fast)
   ```bash
   python -m source_discovery review
   ```
   Shows candidates one-by-one with context, accept/reject/skip

3. **Web UI** (Future)
   - Dedicated review interface with source preview
   - Side-by-side comparison with existing sources

**Review Decision Tree:**

```
For each candidate:
├── View source preview (recent content sample)
├── Check against existing sources (avoid duplicates)
├── Evaluate quality and relevance
└── Decision:
    ├── Approve → Set Status = "Approved", add Final Score
    ├── Reject → Set Status = "Rejected", add Review Notes
    ├── Needs Research → Set Status = "Under Review", add questions
    └── Skip → Leave as "New" for later
```

---

### Stage 4: Activation (Automated)

**Trigger:** Status changed to "Approved"

**Actions:**
1. Copy candidate to Notion "Sources" database
2. Set `is_active = TRUE`
3. Candidate appears in next sync job (Story 1.3)
4. news_collector begins ingesting from new source

**Cleanup:**
- Rejected candidates archived after 30 days
- Approved candidates removed from "Source Candidates" after sync

---

## Agent Configuration

### Discovery Profile

Define what types of sources to discover:

```yaml
# config/discovery_profile.yaml

topics:
  - name: "AI Safety"
    keywords: ["AI safety", "AI alignment", "AI risk", "AGI safety"]
    priority: high

  - name: "Machine Learning Research"
    keywords: ["machine learning", "deep learning", "ML research", "arxiv"]
    priority: high

  - name: "Tech Policy"
    keywords: ["AI regulation", "tech policy", "AI governance"]
    priority: medium

source_types:
  RSS:
    enabled: true
    min_frequency: "weekly"  # Posting frequency requirement
    require_full_content: true

  YOUTUBE:
    enabled: true
    min_subscribers: 1000
    max_subscribers: 1000000  # Avoid too mainstream
    min_frequency: "monthly"

  TWITTER:
    enabled: true
    min_followers: 500
    max_followers: 500000
    require_consistent_posting: true

  REDDIT:
    enabled: true
    min_subscribers: 1000
    exclude: ["r/MachineLearning"]  # Already tracked

  BLOG:
    enabled: true
    require_rss: true  # Must have RSS feed

exclusions:
  domains:
    - "medium.com/@company-*"  # Corporate blogs
    - "*.substack.com"  # Already tracked via RSS

  patterns:
    - "*-news.com"  # Generic news sites
```

### Scoring Rules

```yaml
# config/scoring_rules.yaml

scoring:
  relevance:
    weight: 2.0
    method: "keyword_match"  # or "llm_evaluation"
    llm_prompt: |
      Rate the relevance of this source to {topics} on a scale of 0-2.
      Source: {source_name}
      Sample content: {sample_content}

  consistency:
    weight: 1.0
    method: "frequency_analysis"
    min_posts_per_month: 4

  authority:
    weight: 1.0
    signals:
      - "domain_age > 1 year"
      - "has_about_page"
      - "cited_by_known_sources"

  engagement:
    weight: 1.0
    method: "relative_to_niche"

thresholds:
  auto_approve: 4.5  # Score >= 4.5 can skip human review (optional)
  auto_reject: 2.0   # Score < 2.0 filtered before staging
  staging: 3.0       # Score >= 3.0 goes to staging queue
```

---

## CLI Interface

### Commands

```bash
# Run discovery (scheduled or manual)
python -m source_discovery discover --topic "AI Safety" --type RSS

# Review candidates interactively
python -m source_discovery review --status new --limit 10

# Approve a specific candidate
python -m source_discovery approve <candidate_id> --score 4

# Reject a candidate
python -m source_discovery reject <candidate_id> --reason "Low quality"

# Show discovery stats
python -m source_discovery stats

# Sync approved candidates to Sources database
python -m source_discovery sync
```

### Review Mode Example

```
$ python -m source_discovery review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Candidate #1 of 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: AI Alignment Forum
URL: https://alignmentforum.org/feed
Type: RSS
Auto Score: 4.2 (High Priority)

Topics: AI Safety, ML Research
Reason: High-quality posts on AI alignment, consistent posting

Recent Content Sample:
  "Understanding Deep Double Descent"
  "AGI Safety Fundamentals Course Review"
  "Reflections on the PaLM Technical Report"

Metadata:
  Posts/month: ~15
  Domain age: 4 years
  Has RSS: Yes

Similar to existing sources:
  - LessWrong (different focus, complementary)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Actions: [a]pprove [r]eject [s]kip [p]review [n]otes [q]uit
> a 4

✓ Approved with score 4
Moving to next candidate...
```

---

## Integration Points

### With Story 1.3 (Notion → Postgres Sync)

```
Discovery Workflow          Story 1.3
─────────────────          ─────────
Source Candidates DB  ───┐
     (staging)           │
                        ├──> Sources DB ───> Sync Job ───> PostgreSQL
Approved candidates ────┘    (final)
```

The sync job from Story 1.3 reads from "Sources" database, not "Source Candidates".

### With news_collector

New sources in PostgreSQL are automatically picked up by `news_collector` on next run.

### With Scoring Pipeline

Use existing scoring criteria from the content evaluation pipeline:
- Sources should produce content that scores >= 4
- Discovery agent can learn from which sources produce high-scoring content

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create Notion "Source Candidates" database
- [ ] Build discovery search module
- [ ] Implement candidate staging

### Phase 2: Scoring & Evaluation
- [ ] Implement automated scoring heuristics
- [ ] Add LLM-based relevance evaluation
- [ ] Create duplicate detection

### Phase 3: Review Interface
- [ ] Build CLI review tool
- [ ] Add batch approval/rejection
- [ ] Create review dashboard (Notion view)

### Phase 4: Automation
- [ ] Schedule discovery runs
- [ ] Auto-sync approved to Sources
- [ ] Learn from human decisions (improve scoring)

---

## Metrics to Track

```yaml
discovery_metrics:
  candidates_discovered: count
  candidates_approved: count
  candidates_rejected: count
  approval_rate: percentage
  avg_time_to_review: hours
  sources_by_type: breakdown
  top_topics: list
  discovery_sources: breakdown  # Where candidates come from
```

---

## Future Enhancements

1. **Learning from Feedback**
   - Track which auto-scores align with human scores
   - Adjust scoring weights based on accuracy

2. **Source Recommendations**
   - "Users who added X also added Y"
   - Based on content similarity

3. **Health Monitoring**
   - Alert when sources stop publishing
   - Suggest removal of inactive sources

4. **Competitive Analysis**
   - Track which sources other curators use
   - Identify gaps in coverage
