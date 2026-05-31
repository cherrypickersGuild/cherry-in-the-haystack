# Addendum — Intelligent Web Crawling Package PRD

> Supplementary depth that belongs in downstream documents or earned a place but does not fit the PRD's main narrative.

---

## Cost Model (browser-use token cost)

Per architecture docs, browser-use costs approximately $0.1 per page invocation. This drives the core architectural constraint: browser-use is used only for one-time analysis and fallback, never for routine scheduled collection.

At scale (e.g. 20 active free-form sources, fallback rate ~10%):
- Normal operation: ~0–2 browser-use calls/day → ~$0–0.20/day
- With fallback events: occasional spikes

The Playwright-based path reduces per-article cost to negligible (compute only). The cost optimization goal (NFR-1) is the primary reason the two-tier architecture (browser-use for analysis, Playwright for execution) was chosen over a browser-use-only approach.

---

## Pipeline Flow (text diagram)

```
CONFIG FILE
  └─ New source added
       │
       ▼
  [F-2] AI Page Analysis (browser-use, Python)
       │  runs once per source
       ▼
  [F-3] Playwright Crawler Generation (AI → TypeScript)
       │  stored in crawler_registry + PR opened
       ▼
  [PR MERGE] Manual review gate
       │
       ▼
  [F-4] Scheduled Crawler Execution (TypeScript, Playwright)
       │
       ▼
  [F-5] Data Validation
       │
  ┌────┴────┐
  │         │
VALID    FULL FAILURE
  │         │
  │    [F-6] browser-use Fallback
  │         │
  │    [F-7] Auto-Regeneration (new browser-use analysis + new PR)
  │         │
  └────┬────┘
       ▼
  content.article_raw (PostgreSQL)
       │
       ▼
  Existing pipeline: AI scoring → Notion → daily backup → weekly publish
```

**LinkedIn / browser_use_only sources:**
```
Scheduled cycle
  └─ Skip F-4 entirely
       └─ [F-6] browser-use Vision Collection every run
             └─ content.article_raw → existing pipeline
```

---

## Technical Mechanism Decisions (for Architecture doc)

These belong in the architecture design, not the PRD, but captured here to preserve the reasoning:

- **Why Playwright, not Selenium or direct requests?** Playwright handles dynamic JS-rendered content, matches the existing TS stack, and has strong selector reliability.
- **Why Python for browser-use?** The `browser-use` open-source library is Python-native. The Python component is isolated to analysis and fallback; TypeScript handles all orchestration.
- **Why PR-gated deployment?** Generated code cannot be auto-trusted. A human review gate prevents broken or malicious selectors from running in production. This is the key safety invariant for the self-healing system.
- **Why config-file onboarding, not UI/DB insert?** Keeps source management in version control, traceable in git history, and consistent with existing pipeline conventions.

---

## Source Classification Reference

| Source | Generation Strategy | Notes |
|--------|---------------------|-------|
| Personal blogs | Playwright generation | Standard path |
| Company tech blogs | Playwright generation | Standard path |
| Newsletter web pages | Playwright generation | Email ingestion out of scope v1 |
| GitHub Trending | Playwright generation | Structured enough for reliable selectors |
| Product Hunt | Playwright generation | Standard path |
| Threads | Playwright generation (assumed) | See OQ-2 — fallback if generation fails |
| LinkedIn | browser-use only | `browser_use_only: true`; anti-crawling policy |
| Independent sites (operator-added) | Playwright generation | Standard path; per-site flags available |
