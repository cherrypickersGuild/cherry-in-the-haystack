# Model Updates

Weekly leaderboard + activity feed for foundation model releases (OpenAI, Anthropic, Google, Meta, xAI, DeepSeek, Mistral).

## Sections
1. **Major Players** — 7-card grid ranking the model families by article count this week
   - Layout: 1st place is a large card (2×2 grid span), 2-3 are medium (col-span-2), 4-7 are small
   - Each card: family logo + name + the family's top entity (e.g. GPT-5.4 under OpenAI), rank `#N` badge bottom-right, percent change badge (`↑X%` green / `↓X%` red, or `NEW`) top-right
   - Hover: card border turns purple (`#7B5EA7`)
2. **Rising Star** — single highlighted card for the entity with the highest week-over-week growth
   - `HOT` (or `NEW`) badge in the top-left corner of the card (orange background, slight rounded corners)
   - "Rising Star — Model to Watch" caption in orange text, no background
   - Bold entity name
   - One-line summary
   - Stats block: `N articles this week` and `+X% vs last week`
   - Right side: 2-week momentum sparkline chart in its own bordered mini-card
3. **All Model Updates** — chronological feed of every model-update article in the last 7 days
   - Each row: 3px colored left border (family color), title, one-liner, family chip, ★ rating, `entityName · date`. No avatar/initial circle on the left.

## Data source
- Ranking: `snapshot.model_updates_rank` (built by `model-updates-rank.service.ts`)
- Articles: `content.user_article_ai_state` filtered by `representative_entity_page = 'MODEL_UPDATES'`
