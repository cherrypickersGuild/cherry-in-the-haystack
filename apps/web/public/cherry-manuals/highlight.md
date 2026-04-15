# This Week's Highlight

The default front page (sidebar item: "This Week's Highlight"). Two main sections inside one row, then a list below.

## Layout (top to bottom)
1. **Page header** — page title + a toggle row (renders from `<PageHeader />`)
2. **Two-column row**:
   - **Left — Category Treemap** (`<CategoryTreemap items={landing?.treemap} />`): one block per page (FRAMEWORKS / MODEL_UPDATES / CASE_STUDIES / etc.) sized by share of articles this week
   - **Right — Trending Momentum** (260px sidebar, label "TRENDING MOMENTUM"): a vertical list of cards, one per top-momentum entity
     - Each card: entity name + category, percent change (color-coded), a horizontal bar chart (width = pct / max), and "N articles this week · {page}"
3. **Top Picks This Week** — heading, then a vertical list of articles
   - Each card: category badge (top-left), ★ rating (top-right), bold title, one-liner (line-clamped to 2 lines), `entityName · date · page` footer
   - Left border accent: 3px cherry color (`#C94B6E`)

## Data source
- `GET /api/v1/stats/landing` returns `{ weekStart, weekEnd, treemap, topMomentumEntities }`
- `GET /api/v1/stats/landing/articles` returns the score-5 article list
- Both come from `snapshot.platform_weekly_stat` (a daily-built snapshot keyed by week_start)

## Refresh
- Automatic if `SCHEDULER_ENABLED=true` in `apps/api/.env` — cron runs at minute 10/30/50 of every hour
- Manual: `POST /api/v1/stats/landing/build`
- The treemap and momentum lag by ~1 day because the snapshot key is `today − 6 days` (KST→UTC slice)
