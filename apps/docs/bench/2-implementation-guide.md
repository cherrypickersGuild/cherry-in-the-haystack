# Cherry Bench — 구현 가이드

**기준 문서:** `1-work-guidelines.md` (3-세트 스펙 / 메트릭 정의 / 아키텍처)
**원칙:** 이 문서만 따라하면 Bench 데모가 완성됨.

---

## 담당 범례
- **사용자** — 키 등록, DB 접근 확인, 최종 시연 검증
- **AI** — 코드 작성/실행 (수정은 허락 후)

---

# Day 0 — 사전 확인 (30분)

## STEP 0-1: 환경변수 등록 `사용자`
`.env` 또는 dokploy 설정에:
```
ANTHROPIC_API_KEY=sk-ant-...
COINGECKO_API_KEY=       # 비워둬도 됨
```

**기대**: 백엔드 기동 시 `process.env.ANTHROPIC_API_KEY` 존재.

## STEP 0-2: 현재 레포 상태 확인 `AI`
```bash
git status
git log --oneline -3
```
**기대**: bench 관련 커밋 없음 (새로 시작). 미커밋 변경 있으면 사용자와 상의.

## STEP 0-3: Anthropic SDK 설치 `AI`
```bash
cd apps/api
pnpm add @anthropic-ai/sdk
```
**기대**: `package.json` dependencies 에 `@anthropic-ai/sdk` 추가.

---

# Day 1 — Seed 데이터 + 평가 세트 정의 (2시간)

> 코드보다 **데이터 먼저**. ground truth 확정 후에 평가 로직을 짠다.

## STEP 1-1: 디렉토리 골격 `AI`
```bash
mkdir -p apps/api/src/modules/bench/{tools,evaluators,sets,seed}
```

## STEP 1-2: 세트 정의 파일 작성 `AI`
`apps/api/src/modules/bench/sets/set-definitions.ts`

내용: `1-work-guidelines.md` §4 의 3세트를 **타입 있는 배열**로. 각 세트:
```ts
{
  id: "set-1-oracle" | "set-2-hunter" | "set-3-policy",
  name: string,
  task: string,               // 고정 프롬프트
  systemPrompt: string,
  skills: string[],           // 표시용 라벨
  mcpTools: ToolDefinition[], // Anthropic API tool 스키마
  memoryMode: "none"|"short"|"retrieval",
  evaluatorId: string,
}
```

**검수**: 3세트 모두 `task` 와 `systemPrompt` 가 지침서 §4 와 토씨 하나 안 틀리게 일치.

## STEP 1-3: Marketplace 시드 JSON `AI`
`apps/api/src/modules/bench/seed/marketplace.seed.json`

스펙:
- 전체 20~30 건 (다양성 위해)
- LG Gram 16" sealed under $700 레코드 **정확히 5건** (`gram-01 ~ gram-05`)
- price 기준 오름차순 상위 3건이 **정답 (recall@3)**
- 그 외: MacBook, ThinkPad, 개봉품, 기타 브랜드 혼합

필드:
```json
{
  "id": "gram-01",
  "title": "LG Gram 16\" 2024 — Sealed",
  "price": 590,
  "seller": "techresale_seoul",
  "posted_at": "2026-04-22T03:14:00Z",
  "sealed": true,
  "brand": "LG",
  "model": "Gram 16"
}
```

**검수**:
- `jq '[.[] | select(.brand=="LG" and .model=="Gram 16" and .sealed==true and .price<700)]' marketplace.seed.json | jq 'length'` → `5`
- 상위 3개 price 오름차순 수동 확인, 정답 ID 목록을 `sets/set-definitions.ts` `evalCriteria.expectedIds` 에 박아둠

## STEP 1-4: Karma 문서 시드 `AI`
`apps/api/src/modules/bench/seed/karma-v2.md`

고정 내용(데모에서 질문받는 사실):
- Platinum tier: 70% revenue share
- Gold tier: 50%
- Silver tier: 40%
- Bronze tier: 30%
- tier 승격 조건 (월 기여도) 등 추가 디테일 2~3 문단

정답 key fact: `{ platinum: 70, bronze: 30, docId: "karma-v2" }` 를 `sets/set-definitions.ts` 에 박아둠.

**검수**: 사용자에게 문서 읽어보고 "이 내용으로 고정 OK?" 승인 받기.

## STEP 1-5: Commit `사용자+AI`
```
git add apps/docs/bench apps/api/src/modules/bench
git commit -m "feat(bench): scaffold bench set definitions + seed data"
```

---

# Day 2 — Anthropic 클라이언트 + Tool 실행 (3시간)

## STEP 2-1: Anthropic 래퍼 `AI`
`apps/api/src/modules/bench/anthropic.client.ts`

- Single-shot 호출 + tool-use 루프 구현
- Input: `{ system?, tools?, messages, maxTokens, temperature }`
- Output: `{ text, stopReason, usage, toolCalls[] }`
- 루프: 모델이 `tool_use` 반환 → 서버에서 execute → `tool_result` 메시지 추가 → 다시 호출. max 5 이터레이션.

**검수**: 단위 테스트 or curl 스크립트로 베이스라인(`tools: undefined`) 호출 성공 → 문자열 답변 + usage.

## STEP 2-2: CoinGecko 툴 `AI`
`apps/api/src/modules/bench/tools/coingecko.tool.ts`
```ts
export const coingeckoTool = {
  definition: { name: "get_crypto_price", ... Anthropic schema },
  execute: async ({ symbol }) => {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${map(symbol)}&vs_currencies=usd&include_24hr_change=true`)
    return await r.json()
  }
}
```

**검수**: `curl` 로 CoinGecko 직접 호출 → JSON 받음. 그 다음 툴 실행 유닛 테스트.

## STEP 2-3: Marketplace 툴 `AI`
`apps/api/src/modules/bench/tools/marketplace.tool.ts`

시드 JSON 읽어 필터링. 결과: `{ listings: [...] }`.

**검수**: `execute({ query: "LG Gram 16", max_price: 700, sealed_only: true })` → 정확히 5개, `gram-01~05` 포함.

## STEP 2-4: Catalog 툴 `AI`
`apps/api/src/modules/bench/tools/catalog.tool.ts`

`karma-v2.md` 전체 텍스트 반환 (query 무시해도 됨, 데모이므로). 결과: `{ docs: [{ id: "karma-v2", content: "..." }] }`.

**검수**: 툴 실행 → content 에 "Platinum" 과 "70%" 포함.

---

# Day 3 — 평가 모듈 (2시간)

## STEP 3-1: 공용 타입 `AI`
```ts
type Metric = { id, label, value: number|string, unit?, passed?: boolean }
type EvalResult = { metrics: Metric[], rawJudgeOutput?: string }
```

## STEP 3-2: SET 1 Evaluator `AI`
`apps/api/src/modules/bench/evaluators/set1-oracle.evaluator.ts`

- Ground truth 확보: CoinGecko 재호출 (enhanced와 동일 시점 snapshot 저장 후 재사용)
- 답변에서 `$[\d,.]+` 패턴으로 숫자 추출
- `priceErrorPct = min(|v − truth| / truth * 100)` (여러 숫자면 가장 가까운 것)
- `hallucination = priceErrorPct > 5 ? 1 : 0`
- `citationCount = (/as of \d|timestamp|source[:]/gi 매치 수)`
- `groundedness`: enhanced면 100 (tool 있으니), baseline이면 0

## STEP 3-3: SET 2 Evaluator `AI`
- `JSON.parse` 시도 → schemaPass 0/1
- listings 필드 순회 → `expectedIds` 와 교집합 → `recallAt3 = overlap/3`
- listing.id 별로 DB 조회 → 실존 비율 = `authenticity`
- price 필드 DB 값과 문자열 비교 → exact match 비율

## STEP 3-4: SET 3 Evaluator `AI`
- regex `\[doc:[^\]]+\]` 매치 수 → `citationCount`
- `/70[^0-9]*%/` 포함 여부, `/30[^0-9]*%/` 포함 여부 → keyFactAccuracy = n/2
- LLM-judge 호출:
  - prompt: "Given ground truth doc below, list factual claims in ANSWER that are NOT supported by DOC. Return JSON: { unsupported: string[] }"
  - `hallucinatedFactRate = unsupported.length / totalClaims` (totalClaims 는 judge가 세줌)
- Abstention probe는 데모에서 별도 태스크로 추가해도 되고 skip 가능

## STEP 3-5: LLM Judge 유틸 `AI`
`apps/api/src/modules/bench/evaluators/llm-judge.ts`

- claude-3-5-haiku 사용 (저렴)
- system: "You are a strict fact-check judge. Respond ONLY with JSON."
- 공통 재사용 가능한 래퍼

---

# Day 4 — 서비스 오케스트레이션 + 컨트롤러 (2시간)

## STEP 4-1: BenchService `AI`
`apps/api/src/modules/bench/bench.service.ts`

```ts
async compare(setId: string) {
  const set = getSetById(setId)
  const groundTruth = await captureGroundTruth(set)  // set별 달라짐

  const [baseline, enhanced] = await Promise.all([
    this.anthropic.call({ messages: [{role:"user", content:set.task}] }),  // 도구 없음
    this.anthropic.call({
      system: set.systemPrompt,
      tools: set.mcpTools.map(t => t.definition),
      messages: [{role:"user", content:set.task}],
      toolExecutor: byToolName(set.mcpTools),
    }),
  ])

  const evaluator = getEvaluator(set.evaluatorId)
  const baselineEval = await evaluator.evaluate({answer: baseline.text, groundTruth, hadTools: false})
  const enhancedEval = await evaluator.evaluate({answer: enhanced.text, groundTruth, hadTools: true, toolCalls: enhanced.toolCalls})

  return { set, baseline: {...baseline, metrics: baselineEval.metrics}, enhanced: {...enhanced, metrics: enhancedEval.metrics}, groundTruth, deltas: computeDeltas(baselineEval, enhancedEval) }
}
```

## STEP 4-2: Controller `AI`
`apps/api/src/modules/bench/bench.controller.ts`

```
POST /v1/kaas/bench/compare { setId }  → BenchCompareResponse
GET  /v1/kaas/bench/sets               → BenchSetSummary[]   (id, name, task)
```

**검수**: curl 로 세 세트 각각 호출 → JSON 응답 스크립트로 확인.

## STEP 4-3: Module 등록 + DI `AI`
`apps/api/src/app.module.ts` 에 `BenchModule` import.

## STEP 4-4: 로컬 E2E 검수 `사용자+AI`
- 백엔드 기동
- 3세트 각각 compare 호출 → deltas 가 예상 방향으로 나오는지 확인:
  - SET 1: enhanced priceErrorPct < 1, baseline > 5
  - SET 2: enhanced recallAt3 == 1, baseline == 0
  - SET 3: enhanced citationCount >= 1, baseline == 0
- **기대 방향 어긋나면 systemPrompt · tool schema 재조정. 코드 통과가 아니라 결과 통과가 기준.**

---

# Day 5 — Workshop UI 업그레이드 (3시간)

## STEP 5-1: API 래퍼 `AI`
`apps/web/lib/bench-api.ts` — fetch 함수 2개 (sets, compare). 타입 공유는 단순 mirror.

## STEP 5-2: 기존 BeforeAfterPreview 교체 `AI`
`apps/web/app/start/workshop/page.tsx` 하단의 `BeforeAfterPreview` (하드코딩 mock) 를 **새 `BenchComparePanel` 컴포넌트**로 교체.

## STEP 5-3: BenchComparePanel 컴포넌트 `AI`
`apps/web/components/cherry/bench-compare-panel.tsx`

구성:
```
┌─ Header: "Benchmark" + 3세트 탭 (Market Oracle / Marketplace Hunter / Policy Expert)
│
├─ Task display (고정 텍스트 + Copy 버튼)
│
├─ [Run benchmark] 버튼 — 클릭 시 loading state
│
├─ 실행 후:
│   ├─ 좌/우 답변 카드 (Before · After)
│   ├─ 메트릭 테이블
│   │   | Metric | Before | After | Δ |
│   │   | ... |
│   ├─ 큰 숫자 강조 3개 (Accuracy ↑ / Hallucination ↓ / Groundedness ↑)
│   └─ Tool calls timeline (enhanced 쪽만)
```

**UX 규칙**:
- Loading 중에는 "Running against Anthropic API…" 표시
- 에러 시 어느 세트가 실패했는지, Anthropic 에러/툴 에러 구분
- Task 텍스트는 editable X (고정). "Run" 만 가능.

## STEP 5-4: 시각 디자인 `AI`
- 크림 팔레트 유지 (`#FDFBF5` 카드 · `#F7F1E0` 페이지)
- Before 카드: 회색-크림 헤더
- After 카드: 붉은 그라디언트 헤더 (기존 BeforeAfterPreview 스타일 유지)
- 메트릭 테이블: before/after 숫자 mono-space, Δ 컬럼은 green(개선) / red(악화) 색
- 하단 "Why this matters" 설명문 (세트별 다른 카피)

## STEP 5-5: 태스크 전환 UI `AI`
- 세트 탭 클릭 → task 문구 바뀜 + 이전 결과 클리어
- 한 번에 하나 세트만 실행

---

# Day 6 — 리허설 + 수정 (2시간)

## STEP 6-1: 3세트 × 5회 리허설 `사용자+AI`
- 각 세트를 5번씩 돌려 **메트릭이 매번 예상 방향** 인지 확인
- 드물게 baseline이 운 좋게 맞추면:
  - systemPrompt 조정 (baseline 더 취약하게 하는 건 아니고, **enhanced 지시를 더 엄격하게**)
  - task 문구 미세 조정 (ambiguity 제거)

## STEP 6-2: 카피 다듬기 `사용자`
- 각 세트 "Why this matters" 문구 검토
- 시각적 간격 / 색상 최종 컨펌

## STEP 6-3: 배포 `사용자+AI`
- `git push` → dokploy 재배포
- 프로덕션에서 3세트 모두 클릭 → 결과 스크린샷

## STEP 6-4: 최종 검수 체크리스트 `사용자`
→ `3-checklist-table.md` 의 모든 항목 green

---

# 확장 (시간 남으면)

- **Task 편집 모드** — 파워 유저용 자유 입력 (원칙 §3-3 위배, 데모에서는 off)
- **결과 히스토리** — 세션별 결과 누적 저장
- **메트릭 시각화** — sparkline, 누적 bar chart
- **세트 4 이상** — 코드 작성 태스크 (Sandbox tool 필요, 범위 확장)

---

## 디버깅 팁

- Anthropic 응답에서 `stop_reason` 이 `tool_use` 이면 루프 안 끝남 → 루프 코드 오류 의심
- Tool 실행 에러는 `tool_result` 의 `is_error: true` 로 모델에 알려야 함. 안 그러면 infinite loop
- CoinGecko rate limit (free: 10~30/min) → 리허설 중엔 snapshot 캐시
- Claude가 JSON 아닌 문자열을 JSON이라 주장하면 system prompt에 `Output ONLY valid JSON. No prose before or after.` 강화
