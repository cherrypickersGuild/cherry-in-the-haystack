# Case Studies

Production deployment stories from companies using LLMs (Anthropic / OpenAI / Google customers).

## Layout
- Grouped by **side category**: `CASE_STUDY` (deployment story) vs `APPLIED_RESEARCH` (lab / research write-up)
- Inside each group: rows by company / model

## Article row
- Title + one-liner
- Side-category chip (Case Study / Applied Research)
- Source date

## Data source
`content.user_article_ai_state` filtered by `representative_entity_page = 'CASE_STUDIES'`. The `side_category_id` (FK to `content.side_category`) drives grouping.
