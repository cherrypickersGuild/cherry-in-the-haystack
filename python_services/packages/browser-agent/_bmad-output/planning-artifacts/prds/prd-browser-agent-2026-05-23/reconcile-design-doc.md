# Reconciliation: Design Doc vs PRD

**Source:** News Collector 확장 파이프라인 설계 (Korean design doc)
**PRD:** Intelligent Web Crawling Package

---

## Gap 1 — Extraction Field Schema (Data Points Dropped)

**Source doc states (Section 2):** The AI-generated crawler must extract: `title`, `body/content`, `date`, `author`, `url`, `summary`

**Source doc states (Section 4-2):** Fallback OCR output fields include: `title`, `summary`, `why_it_matters`, `url`, `published_at`

**PRD:** F-4 says output is "normalized to `article_raw` schema" but never enumerates the fields. The `why_it_matters` field — a semantically distinct, AI-generated editorial field — is completely absent from the PRD. The `author` field is also unmentioned. If `article_raw` does not include these, the PRD will silently drop them.

**Severity:** High — `why_it_matters` is a named output field in the source doc, not an incidental mention. It implies AI must synthesize editorial commentary during fallback collection, not just extract raw HTML data.

---

## Gap 2 — Fallback Trigger Granularity (Behavior Weakened)

**Source doc states (Section 4-1):** Validation logic includes three concrete qualitative checks:
- Title is empty
- Body length is abnormally short
- Date does not match today

**PRD (F-5):** Lists `EMPTY_TITLE`, `SHORT_CONTENT`, `STALE_DATE`, `MISSING_FIELD`, `INVALID_URL` — these names map to the source, so coverage appears adequate at first glance.

**But:** The source explicitly frames `STALE_DATE` as "does today's date data match?" — meaning the validator must compare extracted article dates against the current run date, not just check that a date field exists. The PRD does not specify whether `STALE_DATE` means "date field is absent" or "date is not today." This ambiguity could produce a validator that passes stale content silently.

**Severity:** Medium — the PRD uses the right label but under-specifies the comparison logic.

---

## Gap 3 — Auto-Regeneration Trigger Scope (Behavior Weakened)

**Source doc states (Section 4-4):** Crawler auto-regeneration fires whenever a fallback occurs. The intent is fully automatic: detect failure → re-analyze → rewrite crawler → active from next run.

**PRD (F-7):** "Re-analysis → new crawler → new PR on fallback event" — the PR-based deployment gate (NFR-4) is introduced as a non-functional requirement and also referenced in Scope ("PR-based deployment gate for all generated crawlers").

**Gap:** The source doc says the new crawler becomes active "from the next run" (다음 실행부터 정상 동작). The PRD's PR gate means a human must merge before the regenerated crawler activates. This is a meaningful behavioral change — the source implies near-fully-automated self-healing, while the PRD inserts a mandatory human review step. The PRD does not acknowledge this tension or explain that the PR gate delays self-healing. The operator impact (how long the source stays in fallback/OCR mode pending merge) is unaddressed.

**Severity:** High — this changes the core self-healing promise of the design.

---

## Gap 4 — LinkedIn Strategy Framing (Intent Dropped)

**Source doc states:** LinkedIn's anti-crawling policy is strong enough that HTML crawler generation should be skipped entirely. The source frames `browser-use` for LinkedIn as a permanent default, not a temporary fallback. The word used is "지속적으로" (continuously/persistently).

**PRD (Scope):** "LinkedIn: browser-use only" — correctly captures the outcome.

**Gap:** The PRD does not capture the reasoning or the cost implication. The source doc explicitly flags that browser-use costs ~$0.10/page and is only acceptable one-time for analysis; using it continuously for LinkedIn is an acknowledged exception with elevated ongoing cost. The PRD lists `NFR-1 Cost` without calling out LinkedIn as a known cost anomaly that operators should budget for separately.

**Severity:** Low-Medium — no functional gap, but the cost caveat and the reason for the exception are lost, which could cause confusion during implementation or cost review.

---

## Gap 5 — Playwright Code Storage Location (Specification Missing)

**Source doc states (Section 2):** The workflow is: browser-use analysis → AI writes Playwright crawler code → "이후부터는 생성된 크롤러를 사용" (generated crawler is used from then on). The code is stored somewhere retrievable.

**PRD (F-3):** "AI writes TS crawler, stores in DB, opens PR."

**Gap:** "Stores in DB" conflicts slightly with "opens PR" — a PR implies the code lives in a git repository, not a database. The source doc does not specify storage, but the PRD introduces both "DB" and "PR" without clarifying whether the canonical source of truth for crawler code is the git repo (post-merge) or the DB (pre-merge draft). If both exist, sync and conflict-resolution logic is unspecified. This is a design ambiguity introduced by the PRD that the source doc did not create.

**Severity:** Medium — implementation will require a decision the PRD does not make.

---

## Summary Table

| # | Gap | Source Coverage | PRD Coverage | Severity |
|---|-----|----------------|--------------|----------|
| 1 | `why_it_matters` + `author` fields in extraction schema | Explicit | Absent | High |
| 2 | `STALE_DATE` = date must match today's date (not just present) | Explicit | Under-specified | Medium |
| 3 | Auto-regeneration activates next run vs. PR gate delay | Fully automatic | Human gate inserted, tension unacknowledged | High |
| 4 | LinkedIn browser-use = ongoing cost exception, not just policy | Cost caveat explicit | Cost anomaly not surfaced | Low-Medium |
| 5 | Crawler code storage: DB vs. git repo as canonical source | Not specified | Both mentioned, conflict unresolved | Medium |
