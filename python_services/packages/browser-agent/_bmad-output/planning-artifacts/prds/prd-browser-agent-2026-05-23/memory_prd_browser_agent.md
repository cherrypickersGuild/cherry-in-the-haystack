---
name: prd-browser-agent
description: PRD for the browser-agent intelligent web crawling package — Cherry in the Haystack news collector extension. Finalized 2026-05-23.
metadata:
  type: project
---

PRD finalized for the browser-agent package (Cherry in the Haystack news-collector extension).

**Why:** Extends the existing news pipeline to collect from free-form web pages (personal blogs, GitHub Trending, Product Hunt, Threads, LinkedIn, newsletters, independent sites) that lack RSS/API feeds.

**Core design:** browser-use (Python) does one-time page analysis → AI generates Playwright (TypeScript) crawler → daily scheduled runs → validation → browser-use fallback on failure → auto-regeneration via new PR after 3 consecutive failures. LinkedIn is browser-use only on every run.

**Artifacts:** `_bmad-output/planning-artifacts/prds/prd-browser-agent-2026-05-23/`

**Phase-blockers before implementation:**
- OQ-1: `crawler_registry` + `crawler_analysis` DB schema (architecture team)
- OQ-7: Notion Source Registry DB name and property names (engineering)

**How to apply:** When working on implementation stories or architecture for browser-agent, refer to this PRD for requirements. Direct unresolved schema questions to OQ-1 and OQ-7 owners first.
