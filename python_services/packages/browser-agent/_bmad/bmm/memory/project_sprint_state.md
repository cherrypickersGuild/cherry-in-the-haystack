---
name: project-sprint-state
description: Current sprint status for browser-agent project — which stories are done/in-progress/next
metadata:
  type: project
---

Epic 1 (Source Onboarding Engine): all 7 stories in `review`. Epic 2 (Scheduled Crawling): all 3 stories in `review`. Epic 3 (Fallback Collection & Self-Healing): `in-progress`; Story 3.1 moved to `review` 2026-05-25.

**Why:** Epics 1 and 2 completed, Epic 3 is the active sprint work. Story 3.1 was fully implemented with 52 TS tests + 26 Python tests.

**How to apply:** Next story is 3.2 (crawl4ai-failure-counter-regeneration-trigger) — currently `backlog`. Key context: Story 3.1 intentionally does NOT call `resetConsecutiveFailures` (crawler_registry) on fallback success, leaving that counter intact for Story 3.2's regeneration trigger. Story 3.3 is auto-regeneration-pipeline.
