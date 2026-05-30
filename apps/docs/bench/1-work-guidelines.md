# Cherry Bench — 작업 지침서

**프로젝트 단계:** Workshop Before/After 데모 — "진짜 Anthropic API 호출 + 벤치마크 지표"
**시작일:** 2026-04-23
**범위:** 3개 벤치 세트 · 백엔드 compare 엔드포인트 · 평가 모듈 · Workshop UI 업그레이드
**해커톤 포지셔닝:** "Claude를 에이전트로 만들면 정확도·할루시네이션이 숫자로 얼마나 개선되는지 실시간 시연"

---

## 0. 이 문서의 역할

이 폴더 `apps/docs/bench/` 는 **Bench 데모 구현 작업 도크**.

4-파일 구조(KaaS_plan / arena_plan 과 동일):
| 파일 | 용도 |
|---|---|
| `1-work-guidelines.md` | 규칙 + 3-세트 개요 + 참조 맵 (지금 이 파일) |
| `2-implementation-guide.md` | 단계별 구현 가이드 — 따라하면 완성 |
| `3-checklist-table.md` | 항목별 시작/완료/테스트/검수 체크 |
| `4-progress-log.md` | 세션별 작업 기록 |

---

## 1. 커뮤니케이션 규칙

- AI는 수정 전 **무엇을 왜** 먼저 설명, 설명 없이 코드부터 작성 금지
- 사용자 허락 후 Edit/Write/Bash/git 진행
- 각 STEP 끝에 **기대 결과**가 명시됨 — 다르면 중단하고 보고
- 코드만 읽는 탐색은 자유

---

## 2. 담당 범례
- **사용자** = 사람이 직접 (키 등록, 최종 승인, 수동 검증)
- **AI** = Claude 가 코드 작성/실행 가능
- **사용자+AI** = 사용자가 정보 제공 → AI 반영

---

## 3. 설계 원칙 (바꾸지 말 것)

### 3-1. Ground truth 는 결정론적
- **세트 1**: CoinGecko 실시간 API 응답 = 정답 (결정론적 수치)
- **세트 2**: 시드 DB 레코드 = 정답 (고정 JSON)
- **세트 3**: Cherry 카탈로그 문서 = 정답 (고정 마크다운)

LLM이 "아마도 맞을 것 같은" 답변을 내는 평가는 금지. 기계적 비교 우선.

### 3-2. 평가는 기계적 + 보조 judge
- **1순위**: regex · JSON schema · 수치 diff — 변동 없음
- **2순위 (보조)**: LLM-as-judge — 오픈 텍스트 비교용. hallucination 점수에만 사용

### 3-3. 데모는 사전 리허설된 태스크
- 사이트에서 자유 입력 X. **"Run sample task"** 버튼으로 고정 태스크 실행
- 각 세트마다 태스크 문구 확정 후 변경 금지

### 3-4. Baseline은 완전 무장해제
- `system: undefined`, `tools: undefined`, `messages: [{role:user, content: task}]`
- Enhanced와 유일한 차이는 build 설정. 나머지 모델·온도 동일

### 3-5. 비용 한도
- 1 compare 실행당 ~$0.05 예상 (baseline + enhanced + judge 3회)
- 데모 대상 3세트 × ~10회 리허설 = $1.5 정도 예산

---

## 4. 3-세트 스펙

### SET 1 — Market Oracle (실시간 데이터)
**노리는 실패 모드**: Training cutoff 이후 시세 → 숫자 날조

| | Build |
|---|---|
| System prompt | `You are a crypto market analyst. Always cite current prices with a timestamp and source name. Never guess — if you don't have a tool result, say so.` |
| Skills | Real-time Market Analysis · Citation Discipline |
| MCP Tools | `get_crypto_price(symbol: string)` → CoinGecko `/simple/price` |
| Memory | Short-term (conversation only) |
| **Task (고정)** | `"What is BTC's price right now and the 24h change? Should I sell 0.5 BTC today? Back every numeric claim with the fetched data and include a timestamp."` |

**Ground truth**
- Live: CoinGecko `/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true` 호출 결과 (실행 시점 snapshot)

**메트릭**
| 메트릭 | 계산 | baseline 예상 | enhanced 예상 |
|---|---|---|---|
| Price error % | `|claimed − truth| / truth × 100` | unbounded (±10~30%) | <1% |
| Hallucination | 답변 숫자 중 ground truth 불일치 존재 여부 (binary) | 1 | 0 |
| Citation count | regex `as of \d`, `source:` | 0 | ≥1 |
| Groundedness | 툴콜 출력에 근거한 수치 claim 비율 | 0% | 100% |

---

### SET 2 — Marketplace Hunter (구조화 + 사적 데이터)
**노리는 실패 모드**: 존재하지 않는 데이터 날조 + JSON 스키마 위반

| | Build |
|---|---|
| System prompt | `You are a deal-hunting assistant. Return exactly N listings as valid JSON array: [{id, title, price, seller, posted_at}]. Use only the search tool — do not invent listings. No prose outside the JSON.` |
| Skills | Deal Analysis · Bargain Recognition · Structured Output |
| MCP Tools | `search_marketplace(query: string, max_price: number, sealed_only: boolean)` → 서버 시드 DB |
| Memory | None |
| **Task (고정)** | `"Find the 3 cheapest LG Gram 16-inch laptops under $700, sealed only. Return JSON."` |

**Ground truth**
- 시드 DB (Postgres `kaas_bench.marketplace_listing` 또는 JSON 파일)
- LG Gram 16" 조건 맞는 5개 레코드 준비, price ASC 정렬 상위 3개가 정답

**메트릭**
| 메트릭 | 계산 | baseline | enhanced |
|---|---|---|---|
| Schema pass | `JSON.parse` + 필수 필드 검증 (binary) | 0~30% | 100% |
| Listing authenticity | `id` 필드가 DB에 실존하는 비율 | 0% | 100% |
| Recall@3 | ground truth 상위 3개 중 맞춘 수 / 3 | 0/3 | 3/3 |
| Price field exact match | listing별 price 문자열 일치 여부 | 0% | 100% |

---

### SET 3 — Cherry Policy Expert (도메인 grounding)
**노리는 실패 모드**: 훈련 데이터에 없는 Cherry 자체 정책 날조

| | Build |
|---|---|
| System prompt | `Answer only using retrieved Cherry docs. Cite doc IDs in brackets like [doc:karma-v2]. If the answer is not in retrieved docs, respond exactly: "I don't have that information."` |
| Skills | Cherry Domain Expert · Citation Discipline · Abstention |
| MCP Tools | `search_catalog(query: string, limit: number)` → Cherry 시드 문서 DB |
| Memory | Retrieval context memory |
| **Task (고정)** | `"How does Cherry's Karma tier system reward Platinum curators versus Bronze? Be specific about reward percentages and cite doc IDs."` |

**Ground truth**
- `apps/docs/bench/seed/karma-v2.md` (고정 문서)
- 정답 key fact: `{ Platinum: "70% revenue share", Bronze: "30% revenue share", doc_id: "karma-v2" }`

**메트릭**
| 메트릭 | 계산 | baseline | enhanced |
|---|---|---|---|
| Doc ID citation count | regex `\[doc:[^\]]+\]` 매치 수 | 0 | ≥1 |
| Key fact accuracy | "70%" · "30%" 두 토큰 존재 여부 (binary 각) | 0/2 | 2/2 |
| Hallucinated facts | LLM-judge: 답변 claim 중 doc에 없는 비율 | 60~80% | <10% |
| Abstention trigger | off-topic 서브 태스크에 "I don't have" 응답률 (별도 probe) | 0% | ≥80% |

---

## 5. 세트 간 커버리지

| 실패 축 | SET 1 | SET 2 | SET 3 |
|---|---|---|---|
| 실시간 사실 | ✅ | | |
| 사적 데이터 접근 | | ✅ | ✅ |
| 구조화 출력 강제 | | ✅ | |
| 할루시네이션 감소 | ✅ | ✅ | ✅ |
| 인용 / 근거 제시 | ✅ | | ✅ |
| 모를 때 "모른다" 답하기 | | | ✅ |

3개 합치면 Claude-agent 변환의 주요 효과 축을 모두 커버.

---

## 6. 아키텍처 개요

```
Frontend (/start/workshop BeforeAfterPreview)
   ↓ POST /v1/kaas/bench/compare { setId }
Backend
   ├─ [1] Baseline call: Anthropic API (no system, no tools)
   ├─ [2] Enhanced call: Anthropic API
   │       system = set.systemPrompt
   │       tools  = set.mcpTools (Anthropic tool schema)
   │       tool_use loop 실행 (CoinGecko · DB · 카탈로그)
   ├─ [3] Evaluator module
   │       - 결정론 규칙 (schema / regex / 수치 diff)
   │       - LLM-judge (hallucinated facts 용)
   │
   └─ Response {
        set: { id, name, task },
        baseline: { text, latencyMs, tokens, metrics },
        enhanced: { text, latencyMs, tokens, toolCalls, metrics },
        groundTruth: { summary, sources[] },
        deltas: { accuracy, hallucination, groundedness, citation }
      }
```

---

## 7. 파일 레이아웃

```
apps/api/src/modules/bench/
  bench.module.ts
  bench.controller.ts          # POST /v1/kaas/bench/compare
  bench.service.ts             # orchestrates calls
  anthropic.client.ts          # Claude API wrapper
  tools/
    coingecko.tool.ts          # SET 1
    marketplace.tool.ts        # SET 2
    catalog.tool.ts            # SET 3
  evaluators/
    set1-oracle.evaluator.ts
    set2-hunter.evaluator.ts
    set3-policy.evaluator.ts
    llm-judge.ts
  sets/
    set-definitions.ts         # 3세트 고정 스펙
  seed/
    marketplace.seed.json
    karma-v2.md

apps/web/app/start/workshop/
  page.tsx                     # BeforeAfterPreview 업그레이드
apps/web/components/cherry/
  bench-compare-panel.tsx      # 새 컴포넌트 (세트 선택 + 실행 + 결과)
apps/web/lib/
  bench-api.ts                 # fetch 래퍼
```

---

## 8. 환경 변수 (사용자 준비)

| 변수 | 용도 | 준비자 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude 호출 (baseline + enhanced + judge) | 사용자 |
| `COINGECKO_API_KEY` | (옵션) rate limit 완화, 없어도 무료 tier 동작 | 사용자 |

---

## 9. 참조 맵

- 구현 가이드: `2-implementation-guide.md`
- 체크리스트: `3-checklist-table.md`
- 진행 로그: `4-progress-log.md`
- 기존 MCP 툴 구조 참고: `apps/api/src/modules/kaas/` (catalog 검색 로직 재사용)
- Workshop UI 현재 상태: `apps/web/app/start/workshop/page.tsx` (`BeforeAfterPreview` 섹션 교체 대상)
