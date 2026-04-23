# Cherry Equip (Phase 2) — 작업 지침서

**프로젝트 단계:** Workshop 7-슬롯 전부 살리기 — skill · orchestration 카드 실구현 + "Ultimate" 3 세트
**선행 조건:** `apps/docs/bench/` Day 6 Phase 1 완료 (3 슬롯 wiring 검증됨)
**시작일:** 2026-04-24
**해커톤 포지셔닝:** "모든 슬롯이 진짜로 Claude 의 행동을 바꾼다 — skill 한 장 빼면 측정 가능한 하락, orchestration 바꾸면 성공/실패가 갈림"

---

## 0. 이 문서의 역할

이 폴더 `apps/docs/equip/` 는 **Phase 2 Equip 구현 작업 도크**. bench 와 같은 4-파일 구조.

| 파일 | 용도 |
|---|---|
| `1-work-guidelines.md` | 규칙 + 3 세트 완전 스펙 + 메트릭 (지금 이 파일) |
| `2-implementation-guide.md` | Day 0~N 단계별 구현 가이드 |
| `3-checklist-table.md` | 항목별 시작/완료/테스트/검수 체크 |
| `4-progress-log.md` | 세션별 작업 로그 |

---

## 1. 커뮤니케이션 규칙
- AI는 수정 전 무엇을 왜 먼저 설명, 코드만 작성 금지
- 사용자 허락 후 Edit/Write/Bash/git 진행
- 각 STEP 말미에 **기대 결과** 명시 — 다르면 중단하고 보고
- 코드 탐색은 자유

## 2. 담당 범례
- **사용자** — 키, 최종 승인, 수동 검증
- **AI** — 코드 작성/실행 (허락 후)
- **사용자+AI** — 정보 제공 → 반영

---

## 3. 설계 원칙

### 3-1. "확실히 차이나는" 3 조건 (모든 세트가 충족)
1. **Baseline 구조적 실패** — 학습 컷오프 이후, 사적 데이터, 형식 강제 중 하나
2. **각 부품이 독립 메트릭을 움직임** — 한 슬롯 빼면 해당 메트릭이 실제로 떨어짐 (Day 8 에 21회 검증)
3. **Ground truth 결정론** — JSON schema / regex / 수치 diff 로 기계 판정 우선

### 3-2. 호환 유지 — 3슬롯과 7슬롯 동시 지원
- `/v1/kaas/bench/run` 엔드포인트 시그니처 **변경 없음** (`{ taskId, build }`). build 는 nullable 슬롯 — 3장 채우든 7장 채우든 동일 호출
- Phase 1 의 3 기존 세트(`set-1-oracle` / `set-2-hunter` / `set-3-policy`)는 그대로 보존 — 3슬롯 빌드 정답 시나리오
- Phase 2 새 3 세트: `set-4-quant-analyst` / `set-5-strict-hunter` / `set-6-grounded-researcher` — 7슬롯 빌드 정답 시나리오
- **모든 조합 허용**: 3슬롯 빌드로 7슬롯 태스크 실행 가능(점수 ↓), 7슬롯 빌드로 3슬롯 태스크 실행 가능(점수 ≈ 동일)
- Workshop UI 탭에 기존 3 + 신규 3 = **총 6 태스크** 노출

### 3-3. 카드 ID 규칙
- Skill: `inv-s-<name>` (예: `inv-s-json-strict`)
- Orchestration: `inv-o-<name>` (예: `inv-o-plan-execute`)
- Prompt (신규 3): `inv-p-quant` / `inv-p-strict-hunter` / `inv-p-grounded`

### 3-5. SetTag 확장 (6 태그, 배열 형식)
- 타입: `SetTag = "oracle" | "hunter" | "policy" | "quant" | "strict" | "grounded"`
- 카드 속성: `setTag?: SetTag[]` — **배열** (단일 세트 소속 카드도 `["oracle"]` 형태). 공유 카드(예: JSON Strict) 는 `["quant", "strict"]` 처럼 다수 태그
- UI: `InventoryCard` 우하단에 배열 전체를 순차 렌더 (SetBadge × N)
- `SET_META` 는 6 엔트리 (신규 3 의 symbol/color/softBg 지정)

### 3-4. 평가는 기계적 우선
- 수치·schema·regex 로 판정 가능한 건 우선 deterministic
- LLM-judge 는 hallucination / abstention 에만 사용 (비결정적 반영)

---

## 4. 3 세트 — Ultimate Build Spec

### SET 4 · **Multi-Asset Crypto Analyst** (`set-4-quant-analyst`)
**Task (고정 문구):**
> "Get current USD price and 24h % change for BTC, ETH, and SOL. Pick the one with the largest absolute 24h movement. Output JSON: `{assets:[{sym, price, change24h, captured_at, source}], biggest_mover:{sym, abs_change_pct}}`. Cite timestamp + source per asset."

**7-Slot Build:**
| 슬롯 | 카드 id | 담당 |
|---|---|---|
| Prompt | `inv-p-quant` (Quantitative Analyst) | 3-asset JSON-only analyst |
| MCP | `inv-m-crypto` (기존) | `get_crypto_price(sym)` |
| Skill A | `inv-s-decomp` (Multi-step Decomposition) | "Break into: fetch each → compute max → format" |
| Skill B | `inv-s-json-strict` | "Output ONLY valid JSON matching schema" |
| Skill C | `inv-s-citation` (Citation Discipline) | "Each numeric claim + timestamp + source" |
| Orchestration | `inv-o-plan-execute` | Plan 호출 → execute 호출 2-phase |
| Memory | `inv-me-short` (기존) | fetch 결과 대화 유지 |

**한 슬롯 빼면 떨어지는 메트릭:**
| 빠지는 슬롯 | 떨어지는 메트릭 |
|---|---|
| Prompt | JSON schema pass → 0 |
| MCP | price error % → unbounded, hallucinated numbers ↑ |
| Decomp | asset count → 1~2 (3 아님) |
| JSON Strict | schema pass → 0 |
| Citation | citation/asset → 0 |
| Plan-and-Execute | asset count → 종종 1~2 |
| Memory | biggest_mover 정확도 랜덤 |

**Evaluator 메트릭 (결정론):**
| 메트릭 | 계산 | baseline | full build |
|---|---|---|---|
| JSON schema pass | `JSON.parse` + schema 검증 | 0 | 1 |
| Asset count | `assets.length === 3` | 0~1 | 3 |
| Avg price error % | 각 자산 claim vs CoinGecko truth | unbounded | <1% |
| biggest_mover correct | 계산된 sym 이 실제 최대 절대변동 자산과 일치 | random | 100% |
| Citation/asset | regex `source:` or `captured_at:` per asset | 0 | 3 |

---

### SET 5 · **Constrained Deal Hunter** (`set-5-strict-hunter`)
**Task (고정 문구):**
> "Find the 3 cheapest LG Gram 16-inch laptops under $700 that are **sealed** AND whose seller name does NOT contain 'refurb' or 'used'. Return JSON array `[{id, title, price, seller, posted_at}]`. If fewer than 3 qualify, return only those. Do NOT invent."

**시드 DB 추가 (함정 레코드):**
- 2~3 개의 sealed LG Gram 16" 레코드 중 seller 에 "refurb" 또는 "used" 문자열 포함 — `sealed_only` 필터만으로는 통과. 반드시 skill 로 post-filter 필요.

**7-Slot Build:**
| 슬롯 | 카드 id | 담당 |
|---|---|---|
| Prompt | `inv-p-strict-hunter` | Strict JSON, no invention |
| MCP | `inv-m-market` (기존) | `search_marketplace` |
| Skill A | `inv-s-constraint-sat` | "Apply EVERY filter — reject partial match" |
| Skill B | `inv-s-json-strict` | 형식 강제 |
| Skill C | `inv-s-self-validate` | "Re-read each record; drop fails" |
| Orchestration | `inv-o-self-repair` | "If any result invalid, retry once" |
| Memory | `inv-me-none` (기존) | atomic, 불필요 |

**메트릭:**
| 메트릭 | baseline | no orch/skill | full |
|---|---|---|---|
| JSON schema pass | 0 | 1 | 1 |
| Authenticity (DB 실존) | 0% | 100% | 100% |
| **All-constraints pass** (seller clean) | 0/3 | 1~2/3 | 3/3 |
| Recall@3 (진짜 상위 3) | 0/3 | 1~3/3 | 3/3 |
| Invented count | 3 | 0 | 0 |

**핵심:** Self-Repair + Self-Validation 둘 다 있어야 **3/3 constraints pass** 달성. 하나만 있으면 1~2/3.

---

### SET 6 · **Grounded Policy Analyst (abstention test)** (`set-6-grounded-researcher`)
**Task (고정 문구):**
> "For Cherry's Karma tiers, report for BOTH Platinum and Bronze: (1) revenue share %, (2) minimum monthly contribution to qualify, (3) tier-exclusive perks. Compute revenue share gap (Platinum − Bronze) in pp. Cite doc IDs per fact. For any field NOT in retrieved docs, output `'missing: <field>'` — do NOT guess."

**시드 문서 조작:**
- `karma-v2.md` 에 revenue share % **만** 유지. "minimum monthly contribution" 과 "tier-exclusive perks" **의도적으로 제거** — abstention 테스트용.

**7-Slot Build:**
| 슬롯 | 카드 id | 담당 |
|---|---|---|
| Prompt | `inv-p-grounded` (Grounded Researcher) | retrieve first, cite always, flag missing |
| MCP | `inv-m-catalog` (기존) | `search_catalog` |
| Skill A | `inv-s-multihop` (Multi-hop Retrieval) | "Decompose query; retrieve multiple times" |
| Skill B | `inv-s-citation` | 모든 주장 `[doc:xxx]` |
| Skill C | `inv-s-abstention` | "If doc missing, output 'missing: <field>'" |
| Orchestration | `inv-o-plan-execute` | plan → execute |
| Memory | `inv-me-retrieval` (기존) | 문서 context 유지 |

**메트릭:**
| 메트릭 | baseline | partial | full |
|---|---|---|---|
| 70%/30% correct (Platinum/Bronze) | 0/2 | 2/2 | 2/2 |
| revenue_gap = 40 correct | ✗ | ✓ | ✓ |
| Doc ID citations | 0 | 1~2 | ≥4 |
| **Missing field flagged** (monthly + perks) | 0/2 (날조) | 0~1 | 2/2 |
| Hallucinated facts (LLM judge) | 60~80% | 20% | <5% |

**핵심:** `abstention` skill 이 있어야 "missing: monthly_contribution" / "missing: perks" 가 출력됨. 없으면 날조.

---

## 5. 커버리지 매트릭스

| 실패 축 | SET 4 | SET 5 | SET 6 |
|---|---|---|---|
| 실시간 데이터 fetch | ✅ | | |
| 다중 순차 호출 (multi-tool) | ✅ | | ✅ |
| 엄격 필터 검증 | | ✅ | |
| Self-Repair 재시도 | | ✅ | |
| Plan-and-Execute 구조화 | ✅ | | ✅ |
| 도메인 grounding | | | ✅ |
| Abstention ("모르면 모른다") | | | ✅ |
| JSON 스키마 준수 | ✅ | ✅ | |
| Citation 규율 | ✅ | | ✅ |
| Arithmetic 계산 | ✅ | | ✅ |

---

## 6. 새 카드 인벤토리 (총 신규 12장)

### Skills (7장 · setTag 배열)
| id | title | setTag[] | prompt suffix (system에 append) |
|---|---|---|---|
| `inv-s-decomp` | Multi-step Decomposition | `["quant"]` | "Break the task into subtasks; address each before synthesizing." |
| `inv-s-json-strict` | JSON Strict | `["quant","strict"]` | "Output ONLY valid JSON matching the requested schema. No prose before or after." |
| `inv-s-citation` | Citation Discipline | `["quant","grounded"]` | "Every factual claim MUST include a source or citation in brackets." |
| `inv-s-constraint-sat` | Constraint Satisfaction | `["strict"]` | "Apply EVERY stated filter. Reject any record that fails any constraint." |
| `inv-s-self-validate` | Self-Validation | `["strict"]` | "After drafting, re-read each output and drop items that fail any constraint." |
| `inv-s-multihop` | Multi-hop Retrieval | `["grounded"]` | "Decompose the query; issue multiple retrievals when a single search is insufficient." |
| `inv-s-abstention` | Abstention | `["grounded"]` | "If a required field is not in retrieved content, output 'missing: <field>' — never guess." |

### Orchestration (3장)
| id | title | setTag[] | 동작 |
|---|---|---|---|
| `inv-o-standard` | Standard Loop | `[]` (universal) | 기본 tool_use 루프 (max iter = memory card). **장착 없는 것과 기능 동일** — UX 완결성용 |
| `inv-o-plan-execute` | Plan-and-Execute | `["quant","grounded"]` | **1차 호출**: tools 없이 "Produce a plan as bullet list. Do not act yet." → **2차 호출**: plan 을 assistant turn 주입 + tools 장착 execute |
| `inv-o-self-repair` | Self-Repair | `["strict"]` | 기본 루프 + 완료 후 validator 검증 → 실패 시 1회 재시도 |

### Prompts (신규 3장 · 기존 3 유지)
| id | title | setTag[] |
|---|---|---|
| `inv-p-quant` | Quantitative Analyst | `["quant"]` |
| `inv-p-strict-hunter` | Strict Deal Hunter | `["strict"]` |
| `inv-p-grounded` | Grounded Researcher | `["grounded"]` |

### 기존 카드 마이그레이션 (`setTag` 단일 → 배열)
| id | before | after |
|---|---|---|
| `inv-p-oracle` | `"oracle"` | `["oracle"]` |
| `inv-p-hunter` | `"hunter"` | `["hunter"]` |
| `inv-p-policy` | `"policy"` | `["policy"]` |
| `inv-m-crypto` | `"oracle"` | `["oracle"]` |
| `inv-m-market` | `"hunter"` | `["hunter"]` |
| `inv-m-catalog` | `"policy"` | `["policy"]` |
| `inv-me-none` | `"hunter"` | `["hunter"]` |
| `inv-me-short` | `"oracle"` | `["oracle"]` |
| `inv-me-retrieval` | `"policy"` | `["policy"]` |

### SET_META (6 엔트리)
| tag | symbol | color | softBg |
|---|---|---|---|
| oracle | 🜂 | `#8B6C2A` | `#F5E9C8` (기존) |
| hunter | 🜄 | `#8F1D12` | `#F6D8D0` (기존) |
| policy | 🜁 | `#2D3B66` | `#D8DEEF` (기존) |
| quant | 🜔 | `#5E3A8A` | `#E8DCF4` (신규 — purple, analytical) |
| strict | 🜍 | `#9A4A0F` | `#F5DCC5` (신규 — burnt orange, tight) |
| grounded | 🜚 | `#3F5A2E` | `#DCE8D1` (신규 — earth green, grounded) |

### 총 인벤토리 (Phase 2 완료 시)
- Prompts: 3 기존 + 3 신규 = **6**
- MCPs: 3 기존 = 3
- Skills: 7 신규 = **7**
- Orchestration: 3 신규 = **3**
- Memory: 3 기존 = 3
- **합계 22 카드**

---

## 7. 아키텍처 변경

### 7-1. `composeRuntime` 확장
- `systemPrompt = basePrompt + skillSuffixes.join('\n\n')` (빈 값 필터)
- `skillA/B/C` 카드의 `promptSuffix` 순차 결합 + dedup
- `orchestration` 카드의 `orchId` 를 runtime 에 전달
- **`appliedSlots`**: `skillsActive: number` 필드 **신규 추가**. `skillsIgnored: number` 는 **하위호환 유지** (Phase 2 완료 후 항상 0. 응답 스키마에서 제거 금지 — 프론트 `AppliedSlotsBanner` 가 읽고 있음)

### 7-2. `callClaude` 변형 (export 이름 유지)
- **`callClaude` export 이름은 그대로 유지** — `llm-judge.ts` 등이 이미 import 중. 단순 dispatcher 로 역할 변경만
- 내부 기존 구현을 `callClaudeStandard` 로 분리 (private 모듈 내부에서만)
- 새 input 필드: `orchestration?: 'standard' | 'plan-execute' | 'self-repair'`
  - `plan-execute`: 2-phase 호출
  - `self-repair`: 1차 → validator → 실패 시 1회 재시도
  - `standard` 또는 undefined: 기존 루프 (backward-compatible)

### 7-3. Evaluator 3종 신규
- `set4-quant.evaluator.ts` — JSON + asset×3 + priceErr + biggest_mover 정확도
- `set5-strict-hunter.evaluator.ts` — constraint-pass per record (seller regex + sealed + price)
- `set6-grounded.evaluator.ts` — key fact accuracy + `missing: *` 토큰 검출 + citation count + LLM judge hallucination

### 7-4. Ground truth 캡처 — `evalCriteria.kind` union 확장
현재: `kind: 'oracle' | 'hunter' | 'policy'` → Phase 2 에서 3 kind 추가:
```ts
export type EvalCriteria =
  | { kind: 'oracle'; symbols: { symbol: string }[] }
  | { kind: 'hunter'; expectedIds: string[]; requiredFields: string[]; filter: {...} }
  | { kind: 'policy'; expectedDocIds: string[]; keyFacts: {...}[] }
  // ── Phase 2 추가 ──
  | { kind: 'quant-multi'; symbols: string[] }                  // SET 4
  | { kind: 'strict-hunter';
      expectedIds: string[];
      filter: { brand: string; model: string; maxPrice: number; sealedOnly: true };
      sellerBlocklist: string[] }                                 // SET 5
  | { kind: 'grounded-abstain';
      expectedDocIds: string[];
      keyFacts: { pattern: RegExp; description: string }[];
      expectedMissing: string[] }                                 // SET 6
```
`BenchService.captureGroundTruth()` switch 에 3 case 추가.

### 7-5. Set 정의와 `/run` 의 관계
- `set-definitions.ts` 의 `BenchSetDefinition.systemPrompt` / `tools` / `memoryMode` 필드는 **`/compare` (preset preview) 에서만 사용**
- `/run` 엔드포인트는 build 의 카드에서 **동적으로** systemPrompt / tools / memoryMode 구성. set 의 해당 필드는 무시
- 신규 set-4/5/6 정의에도 상징적 preset 필드 채우되(UI 의 "Suggested tool/memory" 칩 용), `/run` 흐름에는 영향 없음

---

## 8. 파일 레이아웃 (Phase 2 추가)

```
apps/api/src/modules/bench/
  cards/
    card-registry.ts                 # ← 12 신규 엔트리 추가
    compose-runtime.ts               # ← skillA/B/C append + orchestration threading
    orchestration/
      standard.ts                    # 기본 loop 래핑
      plan-execute.ts                # 2-phase call
      self-repair.ts                 # retry loop
  evaluators/
    set4-quant.evaluator.ts          # 신규
    set5-strict-hunter.evaluator.ts  # 신규
    set6-grounded.evaluator.ts       # 신규
  sets/
    set-definitions.ts               # ← set-4/5/6 entries 추가
  seed/
    marketplace.seed.json            # ← 함정 레코드 추가
    karma-v2.md                      # ← 일부 필드 제거 (abstention test)

apps/web/lib/
  workshop-mock.ts                   # ← 12 신규 카드 + setTag 확장
apps/web/components/cherry/
  kaas-workshop-panel.tsx            # ← SET_META 확장 (quant/hunter/grounded)
apps/web/app/start/workshop/
  page.tsx                           # ← 탭 6개 노출, 메트릭 테이블 그대로
```

---

## 9. 환경변수 (이미 있는 것 재사용)
- `ANTHROPIC_API_KEY` — Claude 호출 (baseline + enhanced + judge). Plan-and-Execute 는 1회 추가 호출 필요.
- `COINGECKO_API_KEY` — rate limit 완화 (옵션)

**비용 증분:** 데모 1회당 기존 ~$0.05 → Phase 2 평균 ~$0.10, **최악 케이스 ~$0.20** (SET 6 + Plan-Execute + Self-Repair + judge 모두 발동 시 — baseline 1 + plan 1 + execute 1 + retry 1 + judge 1 = 5 Claude calls).

---

## 10. 참조 맵

- 구현 가이드: `2-implementation-guide.md`
- 체크리스트: `3-checklist-table.md`
- 진행 로그: `4-progress-log.md`
- 선행 Phase 1 문서: `apps/docs/bench/`
- 기존 3 세트 정의: `apps/api/src/modules/bench/sets/set-definitions.ts`
