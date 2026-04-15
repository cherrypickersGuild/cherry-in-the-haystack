---
name: source_discovery
description: Discover and evaluate AI-related Substack newsletters for content curation. Use when the user says "discover sources", "find substacks", "run source discovery", or "find newsletters".
---

You are a Source Discovery specialist. Your job is to search Substack for AI newsletters matching user-specified keywords or topics, score them, and stage candidates to Notion for review.

## Setup

Before running any discovery:

1. **Read the tool source** at `python_services/packages/source_discovery/src/substack_discoverer.py` to understand current capabilities.
2. **Read the config** at `python_services/packages/source_discovery/config/discovery_profile.yaml` for available topics and keywords.
3. **Check checkpoint** — if `.discovery_checkpoint.json` exists in the package root, consider using `--resume` to avoid re-fetching.

## Execution

Run discovery from `python_services/packages/source_discovery`:

```bash
# All topics from config
python -m src.substack_discoverer --all-topics --stage

# Resume interrupted discovery
python -m src.substack_discoverer --all-topics --stage --resume

# Single topic
python -m src.substack_discoverer --topic "Model Updates" --stage

# Custom keywords for a topic
python -m src.substack_discoverer --topic "Case Studies" \
  --keywords "AI case study" "enterprise AI" \
  --max-results 10 --stage

# Check checkpoint status
python -m src.substack_discoverer --checkpoint-status

# Start fresh
python -m src.substack_discoverer --clear-checkpoint --all-topics --stage
```

## Key Flags

| Flag | Purpose |
|------|---------|
| `--all-topics` | Run all topics from config |
| `--topic "NAME"` | Run a single topic |
| `--keywords ...` | Override config keywords |
| `--max-results N` | Limit results per topic |
| `--stage` | Stage passing candidates to Notion |
| `--resume` | Skip already-checked URLs/topics |
| `--checkpoint-status` | Show checkpoint state |
| `--clear-checkpoint` | Reset and start fresh |

## Scoring (for reference)

| Factor | Points | Criteria |
|--------|--------|----------|
| Topic Relevance | 0-2 | Keywords in name/description/posts |
| Posting Consistency | 0-1 | Post count threshold |
| Subscriber Count | 0-1 | 1K-100K = 1.0 |
| Content Quality | 0-0.5 | >= 3 recent posts |

Min score to stage: **3.0**. Priority: High (>=4.0), Medium (>=3.5), Low (<3.5).

## Workflow

1. Understand what the user wants (topic, keywords, or full discovery)
2. Run the appropriate command
3. Report results: candidates found, scores, staging status
4. Remind user to review in Notion Source Candidates database
