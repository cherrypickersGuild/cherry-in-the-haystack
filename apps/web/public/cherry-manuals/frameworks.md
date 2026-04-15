# Frameworks

Hierarchical view of AI engineering frameworks organized by category.

## Sections
1. **Category hierarchy** — one card per category (Agent / Fine-Tuning / RAG / Serving / Data & Storage / LLMOps / Observability), with EntityPill chips inside (LangGraph, vLLM, ChromaDB, etc.). Each category card has a hover effect (border darkens to purple).
   - Spotlight entities (`is_spotlight = true`) render with a special star marker on the pill
2. **Rising Star** — top-growing framework category this week
   - `HOT` (or `NEW`) badge in the top-left corner of the card (purple background, slight rounded corners)
   - "Rising Star — Framework to Watch" caption in purple text, no background
   - Bold category name
   - One-line summary
   - Stats: `N articles this week` and `+X% vs last week`
   - Right side: trend sparkline in its own bordered mini-card with "Trend" label
3. **Articles** — feed of framework-tagged articles in the last 7 days
   - Each row: 3px colored left border, title, one-liner, category chip, ★ rating, `entityName · date`. No avatar/initial circle on the left.

## Data source
- Categories + entities: `content.tracked_entity_placement` where `entity_page = 'FRAMEWORKS'`
- Rising star: `snapshot.frameworks_rank` (built by `frameworks-rank.service.ts`)
- Articles: `content.user_article_ai_state` joined with `personal.entity_follow` (only follows feed)
