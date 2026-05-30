# Cherry Bench — 체크리스트

범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료

---

## Day 0 — 사전 확인

| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 환경변수 (ANTHROPIC_API_KEY) 등록 | - | 사용자 |
| 0-2 git status clean | - | AI |
| 0-3 `@anthropic-ai/sdk` 설치 | - | AI |

## Day 1 — Seed 데이터 + 세트 정의

| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 `modules/bench/` 디렉토리 골격 | - | |
| 1-2 `sets/set-definitions.ts` 3세트 정의 | - | 지침서 §4 토씨 일치 |
| 1-3 `seed/marketplace.seed.json` LG Gram 5건 포함 | - | jq 검증 |
| 1-4 `seed/karma-v2.md` 고정 | - | 사용자 승인 |
| 1-5 커밋 `feat(bench): scaffold` | - | 사용자+AI |

## Day 2 — Anthropic + Tools

| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 `anthropic.client.ts` tool_use 루프 | - | max 5 iter |
| 2-2 `coingecko.tool.ts` | - | CoinGecko /simple/price |
| 2-3 `marketplace.tool.ts` | - | 시드 JSON 필터 |
| 2-4 `catalog.tool.ts` | - | karma-v2.md 반환 |

## Day 3 — Evaluators

| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 공용 타입 `Metric` / `EvalResult` | - | |
| 3-2 SET 1 Oracle evaluator | - | priceErrorPct, hallucination, citation |
| 3-3 SET 2 Hunter evaluator | - | schema, authenticity, recall@3 |
| 3-4 SET 3 Policy evaluator | - | docId, keyFact, judge |
| 3-5 LLM judge 유틸 (haiku) | - | JSON-only |

## Day 4 — 서비스 / 컨트롤러

| 항목 | 상태 | 메모 |
|---|---|---|
| 4-1 `BenchService.compare` | - | Promise.all baseline+enhanced |
| 4-2 `POST /v1/kaas/bench/compare` | - | body: { setId } |
| 4-2b `GET /v1/kaas/bench/sets` | - | id·name·task |
| 4-3 Module 등록 | - | app.module.ts |
| 4-4 E2E: 3세트 curl 호출 방향 확인 | - | **결과 통과 기준** |

## Day 5 — Workshop UI

| 항목 | 상태 | 메모 |
|---|---|---|
| 5-1 `lib/bench-api.ts` | - | sets · compare |
| 5-2 기존 BeforeAfterPreview 제거 | - | |
| 5-3 `bench-compare-panel.tsx` | - | 탭 · task · run · 결과 |
| 5-4 시각 디자인 (크림 팔레트) | - | |
| 5-5 세트 전환 UX | - | 이전 결과 클리어 |

## Day 6 — 리허설

| 항목 | 상태 | 메모 |
|---|---|---|
| 6-1 SET 1 × 5회 방향 확인 | - | priceErrorPct diff 일관성 |
| 6-1 SET 2 × 5회 방향 확인 | - | recall@3 일관성 |
| 6-1 SET 3 × 5회 방향 확인 | - | citationCount diff |
| 6-2 "Why this matters" 카피 승인 | - | 사용자 |
| 6-3 프로덕션 배포 | - | dokploy |
| 6-4 최종 검수 전체 green | - | 사용자 |

---

## 성과 목표 (데모 완성 기준)

- SET 1: enhanced priceErrorPct **< 2%**, baseline > 5% (5회 모두)
- SET 2: enhanced recall@3 **= 3/3**, baseline = 0/3 (5회 모두)
- SET 3: enhanced citation count **≥ 1**, baseline = 0 (5회 모두)
- UI에서 Δ 값이 양(개선)으로 표시됨 (accuracy↑, hallucination↓)
- 한 compare 호출 **< 20초** (tool-use 루프 5iter 상한 기준)
