# Source Discovery Agent

Human-in-the-loop source discovery workflow for discovering, evaluating, and adding new content sources.

## Quick Start

```bash
# Discover sources for a topic
python -m source_discovery discover --topic "AI Safety" --type RSS --stage

# Review candidates interactively
python -m source_discovery review --status new --limit 10

# Approve a specific candidate
python -m source_discovery approve <candidate_id> --score 4

# Sync approved to sources database
python -m source_discovery sync --sources-db <notion_sources_db_id>
```

## Configuration

Set environment variables:

```bash
export NOTION_TOKEN="your_notion_token"
export OPENAI_API_KEY="your_openai_key"  # Optional, for LLM-based evaluation
export NOTION_CANDIDATES_DB_ID="candidates_database_id"
export NOTION_SOURCES_DB_ID="sources_database_id"
```

## Workflow

```
Discovery → Staging → Human Review → Approval → Sync
```

See [docs/workflows/source-discovery-workflow.md](../../../docs/workflows/source-discovery-workflow.md) for full workflow documentation.
