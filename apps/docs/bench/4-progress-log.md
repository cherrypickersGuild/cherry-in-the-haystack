# Cherry Bench — 진행 로그

세션별로 "무엇을 어디까지 했는지" 기록. 다음 세션에서 이 로그만 읽고 이어갈 수 있게.

포맷:
```
## YYYY-MM-DD HH:MM — <작업자> — <세션 제목>
- 완료: ...
- 이슈: ...
- 다음: ...
```

---

## 2026-04-23 — AI — 기획 문서 작성

- 완료:
  - `apps/docs/bench/` 폴더 생성
  - `1-work-guidelines.md` — 3-세트 스펙 / 메트릭 / 아키텍처 / 환경변수
  - `2-implementation-guide.md` — Day 0~6 단계별 가이드
  - `3-checklist-table.md` — 항목별 체크리스트
  - `4-progress-log.md` — 이 파일 (템플릿)
- 이슈: 없음
- 다음: 사용자 기획 승인 → Day 0 환경변수 등록부터 시작

---

## 2026-04-23 — AI — Day 0 + Day 1 실행

- Day 0 완료:
  - `ANTHROPIC_API_KEY` 라벨 달고 `apps/api/.env` 하단에 섹션 주석과 함께 고정
  - Anthropic smoke test: `claude-haiku-4-5` 에 "pong" 요청 → HTTP 200, `output_tokens=5` 반환 확인
  - `@anthropic-ai/sdk` 이미 `apps/api/package.json` 에 `^0.88.0` 로 설치되어 있어 스킵
- Day 1 완료:
  - 1-1 디렉토리: `apps/api/src/modules/bench/{tools,evaluators,sets,seed}` 생성
  - 1-2 세트 정의: `sets/set-definitions.ts` — 3 세트 + `AnthropicToolSchema` · `EvalCriteria` (discriminated union) · `BenchSetDefinition` · `summarizeSet()` 헬퍼. task / systemPrompt 는 지침서 §4 와 토씨 일치
  - 1-3 마켓플레이스 시드: `seed/marketplace.seed.json` — 24건, `gram-01..05` (LG Gram 16" sealed <$700) 포함. `jq` 로 교차검증: 조건 매칭 5건 / 상위 3개 id = `["gram-01","gram-02","gram-03"]`
  - 1-4 Karma 문서: `seed/karma-v2.md` — Platinum 70% / Gold 50% / Silver 40% / Bronze 30% 공식 명시, 승격 조건 · 디몬션 · 분쟁 해결 섹션까지 포함
- 이슈: 없음
- 다음: Day 2 — `anthropic.client.ts` tool-use 루프 + 3개 tool 구현 (`coingecko`, `marketplace`, `catalog`)

---

## 2026-04-23 — AI — Day 2 실행 (클라이언트 + 3 tool + smoke test)

- 완료:
  - `tools/tool-registry.ts` — `BenchTool` 인터페이스 + `buildToolDispatcher(tools[])` 헬퍼
  - `tools/coingecko.tool.ts` — `fetchCryptoPrice(symbol)` + BenchTool export. BTC/ETH/SOL/XRP/ADA 매핑
  - `tools/marketplace.tool.ts` — 시드 JSON 1회 캐싱, 토큰 기반 query 매칭 + price/sealed 필터 + price ASC 정렬
  - `tools/catalog.tool.ts` — karma-v2 문서 로드, keyword 스코어링 기반 검색
  - `anthropic.client.ts` — `callClaude({ system?, tools?, messages, toolDispatcher? })` 단일 entry. tool-use 루프는 max 5 iter, 툴 에러 발생 시 `is_error: true` 로 모델에 전달. `toolCalls[]` 배열에 input/output/duration 전부 기록
  - `smoke-test.ts` — 3개 tool 동작 + Claude baseline + Claude enhanced 시나리오 통합 점검
- smoke test 결과 (실제 호출):
  - `get_crypto_price("BTC")` → priceUsd 77255, change24hPct -0.98 ✓
  - `search_marketplace` → 매칭 5건, 상위 3 id `gram-01/02/03` ✓
  - `search_catalog("karma platinum bronze")` → `karma-v2` 반환, 본문 1894자, "70%" 포함 ✓
  - Baseline (no tools): "I don't have the ability to fetch real-time data…" — 5초 미만, hallucinated number 0
  - Enhanced (tool-use): 2 iter, 1 tool call, `$77,255 · -0.98% · fetched at ... · Source: CoinGecko` 인용 포함 응답
- 주요 관찰 (Day 3 평가 설계에 반영):
  - **Modern Claude 4.5 baseline 은 숫자를 "날조" 하기보다 "추상" (abstain) 하는 경향**. 따라서 Set 1 메트릭은 "priceError %" 만으로는 차이가 작고, **Task Completion (숫자로 답했는가)** 을 주력 metric 으로 써야 명확
  - 평가 로직을 abstention-case 와 fabrication-case 둘 다 커버하도록 설계할 것
- 이슈:
  - Shell 이 `ANTHROPIC_API_KEY` 를 빈 문자열로 미리 정의해 둬서 dotenv 가 덮어쓰지 않음 → `loadDotenv({ override: true })` 로 해결 (smoke-test에 반영). Nest 앱 부팅 시에도 동일 옵션 필요
- 다음: Day 3 — evaluator 3종 + LLM judge 유틸. Task Completion · Hallucination · Price/Field/Citation 차별화 지표 구현

---

## 2026-04-23 — AI — Day 3 실행 (평가 모듈)

- 완료:
  - `evaluators/types.ts` — `Metric`, `EvalContext`, `EvalResult`, `Evaluator` 인터페이스 (direction · category · passed 필드)
  - `evaluators/llm-judge.ts` — `askJudge()` 재사용 유틸. haiku-4-5 로 JSON-only 출력 강제. code fence 제거 safe parser
  - `evaluators/set1-oracle.evaluator.ts` — Task Completion · Price Error % · Hallucinated Numbers · Citation count · Tool calls. CoinGecko 실시간 snapshot 을 ground truth 로 사용
    - 수정 사항: 초기 버전에서 파생값($38,737 = 0.5 BTC)을 hallucination 으로 오집계 → **"in-scope band ±50%"** 필터 추가해 BTC 가격 근처 숫자만 평가 대상
  - `evaluators/set2-hunter.evaluator.ts` — JSON schema · Authenticity · Recall@3 · Price exact match · Tool calls. 코드펜스/prose 둘러싼 JSON 파서 내장
  - `evaluators/set3-policy.evaluator.ts` — Doc-ID citation · Key fact regex · Hallucinated facts (LLM judge) · Tool calls
  - `evaluators/index.ts` — registry + `getEvaluator(id)`
  - `smoke-eval.ts` — 3 세트 전부 baseline + enhanced 실행 + 평가 출력 E2E 스크립트
- E2E 실측 결과 (실제 Anthropic + CoinGecko 호출):
  - **SET 1 Oracle**: baseline `Task=No, Price err=—, Halluc=0, Cite=2` / enhanced `Task=Yes, Price err=0.00%, Halluc=0, Cite=4, Tools=1` ✅
  - **SET 2 Hunter**: baseline `Schema=No, Auth=0/0, Recall@3=0/3, PriceMatch=—` / enhanced `Schema=Yes, Auth=3/3, Recall@3=3/3, PriceMatch=100%, Tools=1` ✅
  - **SET 3 Policy**: baseline `DocCite=0, KeyFact=0/2, Halluc=0%` / enhanced `DocCite=2, KeyFact=2/2, Halluc=0%, Tools=1` ✅
  - 3 세트 모두 Task Completion · Authenticity · Key Fact 축에서 명확한 전/후 대비 확보
- 관찰:
  - SET 3 baseline hallucination=0% 는 baseline 이 "I don't have access…" 로 추상해 검증 가능한 claim 자체가 0이라 trivially 0. 핵심 차별화는 citation + key fact 축
  - 실제 해커톤 데모에서도 **Task Completion** + **Recall@3** + **Key Facts** 이 세 binary 지표가 가장 강력한 시각 훅
- 이슈: 없음
- 다음: Day 4 — `BenchService` + `BenchController` (POST /v1/kaas/bench/compare, GET /v1/kaas/bench/sets) + Nest 모듈 등록. dotenv override 옵션은 ConfigModule 설정에도 반영

---

## 2026-04-23 — AI — Day 4 실행 (Nest 서비스 + 엔드포인트)

- 완료:
  - `main.ts` 최상단에 `loadDotenv({ override: true })` 추가 — 쉘의 빈 `ANTHROPIC_API_KEY` 가 Nest ConfigModule 보다 먼저 .env 값으로 덮이게
  - `bench.service.ts` — `listSets()` + `compare(setId)` 오케스트레이션. 같은 ground truth snapshot 으로 baseline + enhanced 평가 병렬 실행, `Metric[]` 결과 반환
  - `bench.controller.ts` — `@Controller('v1/kaas/bench')` + 두 엔드포인트 (`GET /sets`, `POST /compare`). 실패 시 `BENCH_COMPARE_FAILED` 500 에러로 포장
  - `bench.module.ts` + `app.module.ts` 에 `BenchModule` 등록
  - `nest-cli.json` assets 설정 추가 — build 시 `seed/*.json`, `seed/*.md` 를 `dist/modules/bench/seed/` 로 복사 (`ENOENT` 이슈 해결)
- E2E HTTP 실측 결과 (포트 4001, 테스트 인스턴스 → curl):
  - `GET /api/v1/kaas/bench/sets` → 3 세트 summary JSON 정상
  - `POST /api/v1/kaas/bench/compare {setId:"set-1-oracle"}` → BTC live $77,731 (-0.71%) / enhanced 0.00% error · 5 citations / baseline 추상
  - `POST /.../compare {setId:"set-2-hunter"}` → enhanced JSON schema pass · 3/3 authenticity · Recall@3 3/3 · price match 100%
  - `POST /.../compare {setId:"set-3-policy"}` → enhanced [doc:karma-v2] × 2 · keyFacts 2/2 · halluc 0%
  - 3 세트 전부 Nest 경로로 통과 — 프론트 연결 준비 완료
- 이슈:
  - 초기 호출 시 `dist` 에 seed 파일 없어서 ENOENT → nest-cli assets 추가로 해결. 배포 빌드 (dokploy) 에도 동일 설정 반영 필요 (이미 repo에 커밋되므로 자동)
- 다음: Day 5 — 프론트 `bench-api.ts` 작성, 기존 `BeforeAfterPreview` 의 mock `setTimeout` 을 실제 `fetch('/v1/kaas/bench/compare')` 로 교체, 응답 스키마 매핑

---

## 2026-04-23 — AI — Day 5 실행 (프론트 연결)

- 완료:
  - `apps/web/lib/bench-api.ts` 확인 — 타입 전체 미러 (`BenchSetSummary`, `BenchCompareResponse`, `Metric`, `MetricDelta` 등) + `fetchBenchSets` / `runBenchCompare` + `computeMetricDeltas` 유틸 이미 작성돼 있음
  - `apps/web/app/start/workshop/page.tsx` `BeforeAfterPreview` 컴포넌트가 이미 실 API 연결:
    - `useEffect` 로 `/v1/kaas/bench/sets` 호출 · 탭 렌더링
    - "Run benchmark" 버튼이 `runBenchCompare(activeId)` 호출
    - 로딩/에러/비어 있음 상태 각각 `EmptyState` 메시지
    - 응답에서 headline 3개 · Before/After 말풍선 · 메트릭 테이블 · tool call trace · system prompt 펼침 뷰 모두 렌더
  - 타입 체크 (`tsc --noEmit`) — `bench-api.ts` / `workshop/page.tsx` 관련 에러 0건 (다른 모듈 pre-existing 에러만 존재)
- E2E 검증 (로컬 4001 테스트 인스턴스 → curl):
  - 응답 JSON 의 top-level / baseline / enhanced 필수 필드 모두 존재 확인
  - `setId/setName/task/skills/toolNames/systemPrompt/groundTruthSummary/baseline/enhanced/runAt` 체크
  - 각 side 의 `text/latencyMs/tokens/iterations/toolCalls/metrics` 체크
  - Metric shape: `{id,label,value,passed,direction,category}` ✓
  - 실측: SET 1 baseline 추상, enhanced "BTC $…, 24h -0.87% … fetched at … Source: CoinGecko" · metrics 5개씩
- 이슈: 없음
- 다음: Day 6 — 리허설(세트 × 5회) · "Why this matters" 카피 검토 · 프로덕션 배포(dokploy) · 최종 체크리스트 클로징

---

## 2026-04-24 — AI — Day 6 Phase 1 실행 (빌드 ↔ 벤치 진짜 연결)

이전까지는 Workshop 슬롯에 뭘 장착해도 벤치 결과가 같았음 — 프론트가 탭의 `setId` 만 보냈기 때문. 이번 세션에서 **사용자가 장착한 카드 id → 백엔드에서 진짜 Claude 런타임 구성 → 응답** 경로를 전부 붙임.

- 완료:
  - 백엔드 `cards/card-registry.ts` — 9 카드 id 를 실제 구현에 매핑 (prompt 3 = systemPrompt 텍스트 / mcp 3 = BenchTool 인스턴스 / memory 3 = maxIterations 1·5·10)
  - 백엔드 `cards/compose-runtime.ts` — `composeRuntime(build)` → `{ systemPrompt, tools, toolDispatcher, maxIterations, memoryMode, appliedSlots }`. skill/orch 슬롯은 현재 무시(로그에 기록)
  - 백엔드 `BenchService.run(taskId, build)` — task 의 ground truth 캡처 + baseline(아무것도 없음) + enhanced(composeRuntime 결과) 병렬 호출 + 평가
  - 백엔드 `POST /v1/kaas/bench/run { taskId, build }` 엔드포인트 + swagger body 스키마. `/compare` 는 preset preview 용으로 유지
  - 프론트 `runBenchWithBuild(taskId, build)` + `AgentBuildPayload` · `BenchRunResponse` · `AppliedSlots` 타입
  - 프론트 `readActiveBuildFromStorage()` — Workshop 의 `cherry_workshop_state_v7` 에서 활성 빌드 장착 상태 읽음
  - 프론트 `BeforeAfterPreview.runBenchmark()` — 클릭 시 활성 빌드를 `runBenchWithBuild` 로 전송
  - 프론트 `AppliedSlotsBanner` — 실행 후 "Applied to Claude: ✓ prompt ✓ mcp ✓ memory" + "ⓘ N skill/orch equipped — not yet wired (Phase 2)"
  - 기존 task 카드의 preset chips 라벨을 "Suggested tool / Suggested memory" 로 변경 — 사용자의 장착 내용과 구분
- E2E 리허설 (HTTP `/api/v1/kaas/bench/run`):
  | 시나리오 | baseline | enhanced | 해석 |
  |---|---|---|---|
  | EMPTY build | No/—/2 cites | **동일** | Δ ≈ 0, 빈 슬롯은 진짜 무효 |
  | CORRECT (Oracle+Crypto+short) | No/— | **Yes / 0.00% err / 1 tool** | 정답 조합 → 완승 |
  | WRONG (Policy+Catalog) | No/— | "I don't have that information." | Policy prompt 가 진짜로 전달됨 (다른 빌드 = 다른 Claude 출력) |
- 이슈:
  - CoinGecko 무료 tier rate limit (429) — 연속 테스트 시 걸림. 데모에서는 쿨다운 고려 필요 (20~30초 간격)
- 다음 (Phase 2, 나중):
  - Skill 카드 실제 구현 (시스템 프롬프트 후미 clause 추가)
  - Orchestration 카드 (Plan-and-Execute = 2단계 호출) 구현
  - 4번째 프리셋 "Multi-hop Reasoner" — 모든 슬롯 사용
  - 그 전에 프로덕션 배포(dokploy) + 데모 쓸 리허설 한번 더

---
