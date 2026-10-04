# PRD Review: Intelligent Web Crawling Package — News Collector Extension
**Reviewer:** PRD Quality Review  
**Date:** 2026-05-23  
**Verdict:** Solid strategic skeleton with two schema-level phase-blockers and several gaps that will force developer re-negotiation before implementation.

---

## 1. Decision-Readiness

**Score: 3 / 5 — Partially decision-ready**

### What works
- Features are decomposed to a useful level (F-1 through F-8), each with enough specificity to scope work.
- Error codes in F-5 are concrete and actionable.
- The PR-gate pattern is clearly stated and its rationale is given.

### Gaps that will block developers without a PM follow-up

**1.1 DB schema is undefined (PHASE-BLOCKER)**  
OQ-1 and OQ-7 are listed as phase-blockers but the PRD gives no provisional schema, column names, data types, or foreign-key relationships for `crawler_registry`, `crawler_analysis`, or the Notion Source Registry sync. A developer cannot begin any data layer work — which underlies F-2, F-3, F-4, and F-7 — without this. A recommended minimum: include a strawman schema with the known fields so the open question is about refinement, not creation.

**1.2 Notion Source Registry sync behavior underspecified (F-1)**  
"PR opened for sync changes" raises immediate questions with no answers:
- What is the PR format/template?
- Who is the required reviewer?
- Does a stale open PR block subsequent syncs?
- What change types trigger a PR vs. a silent update?

**1.3 AI Page Analysis output contract missing (F-2)**  
F-2 says the analysis "identifies content area, pagination, field locations" and stores "structured JSON." The exact JSON schema for this output is not defined. Since F-3 (Playwright generation) consumes this JSON as its primary input, any ambiguity here propagates directly into the code-generation prompt and the DB storage contract. A concrete example or at minimum a field list is needed.

**1.4 Playwright code generation prompt / constraints not specified (F-3)**  
The PRD says "AI writes TS Playwright code" but does not state:
- Which LLM/model is used for generation.
- Whether there is a fixed prompt template or it is inferred at runtime.
- What the code must and must not do (e.g., no network calls beyond the target domain, no secrets, max file size).
- How the generated file is named/versioned in the `generated/` directory.

Without this, two developers could produce incompatible implementations.

**1.5 Dedup logic is partially specified (F-4)**  
`representative_key_hash + content_hash` are named but not defined. What fields compose each hash? What is the collision-resolution behavior (skip silently, log, error)? This is low-level but directly affects correctness.

**1.6 Auto-regeneration trigger threshold is absent (F-7)**  
F-7 says auto-regen fires "on fallback." F-5 says "full-run failure triggers fallback." It is unclear whether a single failed run is sufficient to trigger a PR, or whether N consecutive failures are required. A single transient network error generating an unwanted PR would create operational noise.

---

## 2. Substance

**Score: 4 / 5 — Mostly substantive**

The PRD avoids the common anti-pattern of copying requirements straight from a stakeholder conversation without refinement. The problem statement, goals, and feature set are coherent and non-generic.

### Minor substance gaps

**2.1 NFR-3 latency target has no basis**  
NFR-3 states "Playwright path ≤5 min/source/run [ASSUMPTION]" but there is no load model behind it — how many sources are expected? If the daily schedule runs 50 sources sequentially at up to 5 min each, that is over 4 hours. If parallel, what is the concurrency model? The latency NFR needs either a total-run-time SLA or a concurrency budget to be useful.

**2.2 NFR-1 cost model is stated but not bounded**  
"browser-use ≤1×/source/stable period" is correct as a policy but gives no total-cost estimate or budget ceiling. Since LinkedIn is called out as ~$0.10/run/source, a simple table showing expected monthly cost at N sources would make this testable at planning time.

**2.3 G-2 "stable period" is not defined**  
The cost goal and NFR-1 both rely on "stable period" but it is never defined. Is it until the site structure changes? A fixed number of days? Until manual re-trigger? This is the key term that determines whether the cost goal is achievable.

---

## 3. Strategic Coherence

**Score: 4 / 5 — Coherent, with one tension**

Goals, scope, and features form a clear story: reduce manual onboarding burden, keep LLM costs low by generating reusable Playwright crawlers, fall back gracefully, and self-heal with human oversight via PR gates. The decision to keep PRs manual (no auto-merge) is a deliberate trade-off that is clearly stated.

### One coherence tension

**3.1 G-2 (minimize LLM cost) vs. F-7 (auto-regen on any fallback)**  
F-7 triggers a browser-use analysis re-run plus a new Playwright generation call on every full-run failure. For high-churn sites, this could violate the "≤1× per stable period" intent. The PRD notes "no retry loop" but does not cap total re-gen frequency per source per time window. This is the most important assumption risk (see Section 5).

---

## 4. Completeness

**Score: 3 / 5 — Several gaps**

**4.1 No monitoring / observability spec**  
NFR-2 says "failures surface within one scheduled cycle" but there is no spec for how: no alerting mechanism, no dashboard, no on-call path, no distinction between transient and persistent failures. OQ-4 defers to "existing monitoring coverage" but the problem statement says existing scrapers "silently break" — the new system's monitoring story needs to be explicit, not inherited.

**4.2 No rate-limiting or politeness policy**  
For sites without APIs (personal blogs, GitHub Trending), repeated daily Playwright crawls could trigger bot detection or IP bans. There is no mention of request throttling, user-agent configuration, retry-after handling, or robots.txt compliance. This is especially important for LinkedIn and Threads given OQ-6.

**4.3 No versioning strategy for generated crawlers**  
F-3 stores crawlers in `packages/pipeline/src/newly-discovered/sources/generated/`. There is no spec for what happens when a new PR is opened for a site that already has a merged crawler: Does the old file get overwritten? Renamed? Archived? The deprecation mention in F-7 is directional but not a spec.

**4.4 No data retention or cleanup policy**  
`crawler_analysis` and `crawler_registry` will accumulate records including deprecated and failed entries. There is no mention of retention, cleanup, or archiving. This is a minor v1 concern but will become operational debt.

**4.5 No spec for the generated PR content**  
The PR is the primary human-review artifact. The PRD says "open PR" but does not specify: PR title format, body template, which files are included, what automated checks (lint, type-check) must pass before review, or whether the PR links back to the source registry entry. A 10-minute review target (NFR-4) implies a consistent, readable format — this needs to be specified.

---

## 5. Assumption Risk

**Score: 3 / 5 — Several high-risk assumptions**

| Tag | Assumption | Risk Level | Why dangerous |
|-----|-----------|------------|---------------|
| Implicit (F-7) | One fallback = trigger regen | HIGH | Transient failures (network blip, site maintenance) would flood the PR queue with unnecessary regen PRs, defeating the human-gate safety rationale. |
| OQ-2 | Threads is Playwright-feasible | HIGH | Threads requires login and aggressively blocks headless browsers. If this assumption is wrong, Threads becomes browser-use-only (like LinkedIn) and the cost model changes materially. |
| OQ-3 | PR target is main | MEDIUM | Merging generated code directly to main with no staging branch means a bad crawler ships immediately on merge. A generated/ staging branch with CI gating would be safer. |
| NFR-3 [ASSUMPTION] | Playwright ≤5 min/source/run | MEDIUM | No load model backs this. At scale it determines whether daily scheduling is feasible without parallelism. |
| Implicit (F-2) | browser-use reliably identifies content area on first run | MEDIUM | On JavaScript-heavy SPAs or sites behind soft paywalls, the analysis pass may fail silently or produce an incomplete field map, causing generated crawlers to be subtly wrong. |
| "stable period" (G-2, NFR-1) | Site structure is stable enough that ≤1 regen/period is achievable | LOW-MEDIUM | Sites like GitHub Trending or Product Hunt may update their HTML structure on product releases; frequency is unknown. |

---

## 6. Summary Scorecard

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
| Decision-readiness | 3/5 | DB schemas undefined; analysis JSON contract missing |
| Substance | 4/5 | Latency NFR unbounded; "stable period" undefined |
| Strategic coherence | 4/5 | Cost goal vs. regen trigger tension |
| Completeness | 3/5 | No monitoring spec; no rate-limiting policy; no PR content spec |
| Assumption risk | 3/5 | Fallback-triggers-regen and Threads feasibility are highest risk |

**Overall: 3.4 / 5 — Conditionally approvable.** Resolve OQ-1 and OQ-7 with provisional schemas, define "stable period," add a regen-trigger threshold (N consecutive failures), and specify the generated PR content format before handing to engineering. The strategic direction is sound and the feature decomposition is strong; the gaps are in the data contracts and operational details that will otherwise be decided ad hoc during implementation.
