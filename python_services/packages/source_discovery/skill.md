# Substack AI Discovery Engine

Discover and evaluate AI-related Substack newsletters for content curation.

## Overview

This skill uses the `substack_discoverer.py` tool to search Substack for AI newsletters matching topics defined in `discovery_profile.yaml`. Candidates are scored, filtered, and staged to Notion for human review.

**Checkpointing** is enabled by default - URLs are tracked to avoid re-fetching and getting rate-limited.

## Configuration

**Target:** `python_services/packages/source_discovery/config/discovery_profile.yaml`

**Tool:** `python_services/packages/source_discovery/src/substack_discoverer.py`

**Checkpoint:** `.discovery_checkpoint.json` (auto-created)

## Usage

### CLI

```bash
cd python_services/packages/source_discovery

# Run all topics from config (recommended)
python -m src.substack_discoverer --all-topics --stage

# Resume interrupted discovery
python -m src.substack_discoverer --all-topics --stage --resume

# Check checkpoint status
python -m src.substack_discoverer --checkpoint-status

# Clear checkpoint and start fresh
python -m src.substack_discoverer --clear-checkpoint --all-topics --stage

# Single topic discovery
python -m src.substack_discoverer --topic "Model Updates" --stage

# With custom keywords
python -m src.substack_discoverer --topic "Case Studies" \
  --keywords "AI case study" "enterprise AI" "AI implementation" \
  --max-results 10 \
  --stage
```

### Checkpoint Commands

| Flag | Description |
|------|-------------|
| `--all-topics` | Run all topics from `discovery_profile.yaml` |
| `--resume` | Load checkpoint and skip completed topics/URLs |
| `--checkpoint-status` | Show current checkpoint state |
| `--clear-checkpoint` | Delete checkpoint and start fresh |

### Python API

```python
from src.substack_discoverer import SubstackDiscoverer

# Initialize
discoverer = SubstackDiscoverer()

# Load existing sources to avoid duplicates
discoverer.load_all_existing()

# Run discovery
candidates = discoverer.run_discovery(
    topic="Model Updates",
    keywords=["AI models", "LLM releases", "GPT", "Claude"],
    max_results=10,
    stage=True  # Stage to Notion
)

# Results are scored and filtered by min_score (default: 3.0)
for c in candidates:
    print(f"{c.name}: {c.auto_score} ({c.priority})")
```

## Discovery Topics

Defined in `discovery_profile.yaml`:

| Topic | Category | Priority |
|-------|----------|----------|
| Model Releases & API Updates | Research & Models | High |
| Research & Papers | Research & Models | High |
| Benchmarks & Datasets | Research & Models | High |
| Frameworks & SDKs | Engineering & Tooling | High |
| Developer Tools & Services | Engineering & Tooling | High |
| Case Studies & Implementations | Industry & Business | High |
| Regulation & Governance | Discourse | High |
| Patterns & Implementations | Engineering & Tooling | Medium |
| Community | Discourse | Medium |
| Insights & Opinions | Discourse | Medium |
| Technical Deep Dives | Discourse | Medium |

## Notion Integration

Candidates are staged to the Source Candidates database:

- **Name:** Newsletter title
- **URL:** Substack URL
- **Type:** SUBSTACK
- **Category:** PRD category mapping
- **Status:** New
- **Priority:** Based on score
- **Topics:** Discovered topic
- **Sample Content:** Recent post titles

## Duplicate Detection

The discoverer checks both:
1. **Data Sources DB** (approved sources) - skipped
2. **Source Candidates DB** (staging) - skipped

URLs are normalized for comparison (lowercase, no protocol, no trailing slash).

## Rate Limiting

- 2-second delay between searches
- Max 10 requests/hour to Substack (configurable)

## Environment Variables

```bash
NOTION_TOKEN=your_token
NOTION_CANDIDATES_DB_ID=33bf199e-df7c-81f8-b10e-c7fc174aa267
NOTION_SOURCES_DB_ID=1a2f199edf7c8020965ad7d8e22c45cb
```

## Workflow

1. **Load checkpoint** (if `--resume`) - Restore previously checked URLs
2. **Load existing** - Fetch current sources/candidates from Notion
3. **Search** - Query Substack API/known newsletters for keywords
4. **Check checkpoint** - Skip URLs already fetched in previous runs
5. **Enrich** - Fetch RSS feed, metadata, subscriber count
6. **Save checkpoint** - Mark URL as checked (prevents re-fetching)
7. **Score** - Calculate auto-score based on criteria
8. **Filter** - Remove duplicates, below-threshold candidates
9. **Stage** - Add to Notion Source Candidates for review
10. **Mark complete** - Mark topic as completed in checkpoint

## Checkpoint File Structure

```json
{
  "checked_urls": ["author.substack.com", ...],
  "completed_topics": ["Model Updates", "Case Studies"],
  "staged_urls": ["newsletter.substack.com", ...],
  "last_run": "2026-04-08T10:30:00",
  "current_topic": null,
  "pending_candidates": []
}
```

## Example Session

```
$ python -m src.substack_discoverer --topic "Model Updates" --stage

============================================================
Substack Discovery: Model Updates
============================================================

[Substack] Loaded 45 existing sources from Data Sources database
[Substack] Loaded 12 existing candidates from Source Candidates database
[Substack] Total URLs loaded for duplicate checking: 57
[Substack] API found 8 newsletters for 'AI models'
[Substack] Skipping duplicate (in approved sources): https://importai.substack.com
[Substack] Found: The AI Newsletter (score: 4.2)
[Substack] Found: ML Weekly (score: 3.8)

Found 2 candidates meeting threshold

1. The AI Newsletter
   URL: https://theainewsletter.substack.com
   Score: 4.2 (high priority)
   Posts: 156
   Subscribers: 25,000

2. ML Weekly
   URL: https://mlweekly.substack.com
   Score: 3.8 (medium priority)
   Posts: 89
   Subscribers: 8,500

Staging to Notion...
[Substack] Staged: The AI Newsletter
[Substack] Staged: ML Weekly
```

## Next Steps

After discovery:
1. Review candidates in Notion Source Candidates database
2. Approve promising sources → moves to Data Sources
3. Run `sync_sources.py` to update the news collector
