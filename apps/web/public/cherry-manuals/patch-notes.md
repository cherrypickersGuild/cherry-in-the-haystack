# Patch Notes

Weekly changelog — every new article in the last 7 days, sorted newest first.

## Layout
- **Left timeline** — vertical line with one entry per article (date · area, title, one-liner, area chip, side-category chip if any, ★ rating)
- **Right** — Filter by Area card + This Period stats (total updates, score-5 items, new frameworks, regulatory) + guide card

## Read tracking
- Click any item → marks as read (`PATCH /api/patch-notes/:articleStateId/read`)
- Read items: small cherry-red "✓ read" tag appears next to date · area
- Read items disappear from the list on next visit (server filters `read_at IS NULL`)

## Filter chips
All / Models / Frameworks / Case Study / Research / Tools / Big Tech / Posts / Regulations — filters the timeline by `area` field.

## Data source
`content.user_article_state` (read_at) joined with `content.user_article_ai_state` (ai_summary, score, page) and `personal.entity_follow` (only follows feed). Window: last 7 days.

## Notes
- Items 11+ fade in opacity as you scroll
- Bottom card shows `N left to read` or `You're caught up` when all read
