# LLM API Cost Estimation

Date: 2026-03-18

---

## Important Distinction: Claude Code Pro vs Anthropic API

**Claude Code Pro** ($100/month) is interactive coding assistance (Claude Code CLI). It does **not** provide API credits for automated pipelines.

The pipeline's `ANTHROPIC_API_KEY` in `.env.example` is a separate product — **Anthropic API**, billed per token, separate invoice. Both are needed to build and run this system.

---

## Pricing Basis

| Model | Input | Output |
| ----- | ----- | ------ |
| Claude Sonnet (pipeline default) | $3.00 / MTok | $15.00 / MTok |
| OpenAI text-embedding-3-small | $0.02 / MTok | — |

> Verify current pricing at anthropic.com/pricing before budgeting.

---

## News Ingestion Pipeline (daily, ongoing)

Two Claude calls per **unique** article (scoring + classification). Claude is only called after dedup confirms the article is new — duplicates cost nothing.

| Call | Input tokens | Output tokens | Notes |
| ---- | ------------ | ------------- | ----- |
| Scoring | ~1,100 | ~150 | Prompt + truncated article → `{score, summary, reasoning}` |
| Classification | ~1,000 | ~50 | Same article → `{category, tags}` |
| **Per article** | **2,100** | **200** | |

```
Input:  2,100 × $3.00/MTok  = $0.0063
Output:   200 × $15.00/MTok = $0.0030
Total per unique article     ≈ $0.009
```

**Key variable — dedup rate.** With daily crawling of the same sources, expect ~50% of crawled items to be duplicates and skipped before Claude is called.

| Daily crawl volume | After 50% dedup | Daily cost | Monthly cost |
| ------------------ | --------------- | ---------- | ------------ |
| 50 articles | 25 unique | $0.23 | $6.75 |
| 100 articles | 50 unique | $0.45 | $13.50 |
| **200 articles (NFR target)** | **100 unique** | **$0.90** | **$27.00** |
| 400 articles | 200 unique | $1.80 | $54.00 |

NFR target: 100+ items/hour over a 2-hour run = 200 articles/day ceiling → **~$27/month** steady state.

---

## Books / Evidence Pipeline (one-time batch)

Per paragraph chunk (~200 tokens of body text):

| Call | Input tokens | Output tokens | Cost per paragraph |
| ---- | ------------ | ------------- | ------------------ |
| Concept extraction (Claude) | ~600 | ~100 | $0.0033 |
| Embedding (OpenAI) | ~200 | — | $0.000004 |

OpenAI embedding cost is negligible. Claude concept extraction dominates.

| Book size | Paragraphs | Claude cost | Embedding cost |
| --------- | ---------- | ----------- | -------------- |
| Short paper / article | 100 | $0.33 | $0.001 |
| Typical textbook | 500 | $1.65 | $0.004 |
| Long book (~400 pages) | 2,000 | $6.60 | $0.016 |

Initial handbook batch (10 books × 500 paragraphs avg):
```
10 × $1.65 = ~$16.50 one-time
```

---

## Monthly Budget Summary

| Cost item | Monthly |
| --------- | ------- |
| News ingestion — Claude scoring (200/day, 50% dedup) | $27.00 |
| Weekly publish — no LLM calls | $0 |
| Notion backup — no LLM calls | $0 |
| Books pipeline — one-time, amortized over 12 months ($16.50 / 12) | $1.38 |
| OpenAI embeddings (negligible) | ~$0.05 |
| **Total Anthropic/OpenAI API** | **~$28–30/month** |
| Claude Code Pro (development) | $100/month |
| **Combined** | **~$128–130/month** |

---

## Levers

**Reduce cost:**
- Increase dedup aggressiveness — more articles caught before Claude is called
- Combine scoring + classification into one call — cuts per-article tokens by ~40% (currently 2 calls → 1 structured output call)
- Use Gemini Flash as fallback (cheaper) or as primary for classification

**Increase cost:**
- More active sources in `data_sources`
- Twitter/Reddit volume if Twitter API paid tier is enabled
- Re-processing books as the corpus grows

---

## Per-Job LLM Usage Summary

| Job | LLM calls | When billed |
| --- | --------- | ----------- |
| `news-ingestion.ts` | 2× Claude per unique article (score + classify) | Daily, ongoing |
| `notion-backup.ts` | None | — |
| `weekly-publish.ts` | None | — |
| Books evidence ingestion | 1× Claude per paragraph chunk | One-time batch |
| Embeddings | 1× OpenAI per paragraph chunk | One-time batch |
| Writer Agent (Epic 4) | TBD — synthesis per concept page | On-demand |
