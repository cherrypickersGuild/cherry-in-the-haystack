# Cherry Equip (Phase 2) — 구현 가이드

**기준 문서:** `1-work-guidelines.md` (3 세트 스펙 / 카드 / 메트릭 / 아키텍처)
**원칙:** 이 문서만 따라하면 Phase 2 가 완성됨. Day 별로 순차 진행, 각 STEP 말미에 기대 결과 명시. 리허설(Day 8) 전까지는 데모 완성 X.

---

## 담당 범례
- **사용자** — 시드 데이터 승인, 최종 감수, 프로덕션 배포
- **AI** — 코드 작성/실행 (허락 후)

---

# Day 0 — 사전 확인 (30분)

## STEP 0-1: Phase 1 체크 `AI`
```bash
curl -s -X POST http://localhost:4000/api/v1/kaas/bench/run \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"set-1-oracle","build":{"prompt":"inv-p-oracle","mcp":"inv-m-crypto","memory":"inv-me-short","skillA":null,"skillB":null,"skillC":null,"orchestration":null}}' \
  | head -c 200
```
**기대**: `"appliedSlots":{"prompt":true,"mcp":true,"memory":true,...}` 포함 응답.

## STEP 0-2: git clean + 작업 브랜치 `사용자+AI`
- 미커밋 변경 있으면 우선 commit
- Phase 2 진행 중 `v7` 저장 키가 `v8` 로 올라갈 예정 — 알림

## STEP 0-3: 예산 · 비용 확인 `사용자`
- Phase 2 리허설: 3 세트 × 7 슬롯-제거 테스트 = 21 × 2 API call ≈ $2 예산
- 전체 구현 자체 (테스트 포함) ≈ $3~$5 예산

---

# Day 1 — Skill 카드 7장 + 신규 Prompt 3장 (2h)

> 가장 단순한 부분. 시스템 프롬프트 suffix 텍스트만 정의.
>
> ⚠️ **중간 상태 경고**: Day 1 완료 시점에는 skill 카드가 인벤토리에 보이고 슬롯 드래그도 되지만 **동작 없음** (composeRuntime 변경은 Day 2 에서). 사용자 허락받아 Day 1 완료 후 **즉시 Day 2 로 이어서 진행** 권장. 중간 배포 금지.

## STEP 1-1: `CARD_REGISTRY` 확장 `AI`
`apps/api/src/modules/bench/cards/card-registry.ts`

**(1) `CardType` union 확장**:
```ts
export type CardType = 'prompt' | 'mcp' | 'skill' | 'orchestration' | 'memory'
```

**(2) 새 impl 인터페이스 추가**:
```ts
export interface SkillCardImpl {
  type: 'skill'
  promptSuffix: string   // appended to the composed system prompt
}

export interface OrchestrationCardImpl {
  type: 'orchestration'
  orchId: 'standard' | 'plan-execute' | 'self-repair'
}
```

**(3) `CardImpl` 유니온 확장**:
```ts
export type CardImpl =
  | PromptCardImpl
  | McpCardImpl
  | MemoryCardImpl
  | SkillCardImpl         // 신규
  | OrchestrationCardImpl // 신규
```

**기대**: TypeScript 컴파일 통과. 기존 `getCard()` 는 변경 없음 — union 덕에 자동 지원.

## STEP 1-2: 7 Skill 카드 등록 `AI`
지침서 §6 의 7 엔트리를 `CARD_REGISTRY` 에 추가. 예:
```ts
'inv-s-json-strict': {
  type: 'skill',
  promptSuffix: 'Output ONLY valid JSON matching the requested schema. No prose before or after.',
},
```

**검수**: 7 카드 각각 id · title · promptSuffix 가 지침서 §6 과 토씨 일치.

## STEP 1-3: 3 신규 Prompt 카드 등록 `AI`
- `inv-p-quant` — Quantitative Analyst ("3-asset crypto analyst. Output JSON: {assets:[...], biggest_mover:{...}}.")
- `inv-p-strict-hunter` — Strict Deal Hunter ("Return exactly N listings as JSON. Use only search tool.")
- `inv-p-grounded` — Grounded Researcher ("Retrieve first, cite doc IDs, flag missing with 'missing:<field>'.")

**검수**: 세 카드의 systemPrompt 가 각 세트 task 와 명시적 호응.

## STEP 1-4: 프론트 인벤토리 확장 + setTag 배열 마이그레이션 `AI`
`apps/web/lib/workshop-mock.ts`:

**(1) `SetTag` 타입 확장 (6 태그)**:
```ts
export type SetTag = "oracle" | "hunter" | "policy" | "quant" | "strict" | "grounded"
```

**(2) 카드의 `setTag` 필드 단일값 → 배열로 변경**:
```ts
export interface InventoryItem {
  // ...
  setTag?: SetTag[]   // 기존 SetTag → SetTag[]
}
```

**(3) 기존 9 카드 마이그레이션** — 지침서 §6 "기존 카드 마이그레이션" 표 참조. 단일 태그도 `["oracle"]` 형태로.

**(4) 신규 10 카드 등록** — 지침서 §6 의 Skill 7 + Prompt 3. `setTag` 는 배열 그대로 사용 (공유 카드는 2 원소, 단일 소속은 1 원소).

**(5) `SET_META` 3 엔트리 추가** (`quant` / `strict` / `grounded`) — 지침서 §6 "SET_META (6 엔트리)" 표.

**저장키 bump**: `cherry_workshop_state_v7` → `v8`.

## STEP 1-5: `SetBadge` 렌더러 + InventoryCard 배열 대응 `AI`
`apps/web/components/cherry/kaas-workshop-panel.tsx`:

**(1) `InventoryCard` 우하단의 SetBadge 렌더**: `item.setTag?.map(tag => <SetBadge tag={tag} key={tag} />)` — 여러 뱃지 `gap-1` 로 나란히.

**(2) `EquipSlot` 의 compact SetBadge**: 자리 제약상 **첫 번째 태그만** 표시 (`item.setTag?.[0]`) 또는 가장 "대표적" 태그 우선 (그냥 첫 번째로 충분).

**(3) `SET_META` 에 신규 3 엔트리**: `quant` / `strict` / `grounded` 의 symbol / color / softBg 를 §6 표대로.

**검수**: 브라우저에서 공유 카드(JSON Strict 등) 의 뱃지 2개 나란히 렌더 확인. 인벤토리 22 카드 전부 드래그 가능.

## STEP 1-6: 커밋 `사용자+AI`
```
git commit -m "feat(equip): add 7 skill + 3 prompt cards to registry + inventory"
```

---

# Day 2 — Skill prompt composition (2h)

## STEP 2-1: `composeRuntime` 에서 skill suffix 결합 `AI`
`apps/api/src/modules/bench/cards/compose-runtime.ts`

```ts
const skillCards = [build.skillA, build.skillB, build.skillC]
  .map((id) => getCard(id))
  .filter((c): c is SkillCardImpl => c?.type === 'skill')

const suffixes = skillCards.map((c) => c.promptSuffix)
const dedupedSuffixes = Array.from(new Set(suffixes))

const combined = [basePrompt, ...dedupedSuffixes].filter(Boolean).join('\n\n')
const systemPrompt = combined.length > 0 ? combined : undefined
```

`appliedSlots` 업데이트 — **하위호환 유지 규칙**:
- **신규 필드** `skillsActive: number` 추가 (실제 유효 skill 수)
- **기존 필드** `skillsIgnored: number` 는 **제거 금지** — 프론트 `AppliedSlotsBanner` 가 읽는 중. Phase 2 완료 후 항상 0 으로 세팅 (응답 스키마에는 남김)
- 프론트 배너 로직은 이후 (Day 7) 에 `skillsActive > 0` 기준으로 전환

**검수**: unit test — prompt + skill A + skill B 장착 시 `systemPrompt` 에 3 단락 포함, `appliedSlots.skillsActive === 2`, `appliedSlots.skillsIgnored === 0` 확인.

## STEP 2-2: `BenchService.run` 변경 최소화 확인 `AI`
기존 코드가 이미 `composeRuntime` 을 호출하므로 skill append 가 자동 반영됨.
`appliedSlots` 로깅 업데이트.

## STEP 2-3: 스모크 테스트 — skill 효과 확인 `AI`
이미 존재하는 `set-1-oracle` 태스크로 테스트:
- 빌드 A: prompt=inv-p-oracle, mcp=inv-m-crypto, memory=short, **skillA=inv-s-citation**
- 빌드 B: 동일하나 skillA null

**기대**: B 의 citation count 가 A 보다 확연히 작음. 안 그러면 promptSuffix 강화.

---

# Day 3 — Plan-and-Execute orchestration (3h)

## STEP 3-1: `orchestration/plan-execute.ts` 작성 `AI`
```ts
export async function runPlanExecute(input: ClaudeCallInput): Promise<ClaudeCallResult> {
  // Phase A — plan only, no tools
  const planSystem = (input.system ?? '') + '\n\nFirst, produce a bullet-list plan of steps to answer. Do NOT execute yet.'
  const planRes = await callClaudeStandard({ ...input, system: planSystem, tools: undefined, messages: input.messages, maxTokens: 400 })
  const planText = planRes.text

  // Phase B — execute with tools, plan injected as assistant turn
  const execSystem = (input.system ?? '') + '\n\nFollow the plan below step-by-step. Use tools as needed.'
  const execMessages = [
    ...input.messages,
    { role: 'assistant', content: `Plan:\n${planText}` },
    { role: 'user', content: 'Proceed with execution.' },
  ]
  const execRes = await callClaudeStandard({ ...input, system: execSystem, messages: execMessages })

  return {
    text: execRes.text,
    stopReason: execRes.stopReason,
    usage: combineUsage(planRes.usage, execRes.usage),
    toolCalls: execRes.toolCalls,
    latencyMs: planRes.latencyMs + execRes.latencyMs,
    model: execRes.model,
    iterations: execRes.iterations + 1,  // +1 for plan phase
  }
}
```

## STEP 3-2: `callClaude` orchestration dispatcher `AI`

**중요**: `callClaude` 의 **export 이름은 유지**. `llm-judge.ts` 등이 이미 import 중이라 리네임 시 다수 파일 수정 필요.

- 기존 함수 본문을 module-private 함수 `callClaudeStandard` 로 이동 (export 하지 않음)
- export 하는 `callClaude` 는 아래 dispatcher 로 교체:

```ts
export async function callClaude(
  input: ClaudeCallInput & { orchestration?: OrchId },
): Promise<ClaudeCallResult> {
  switch (input.orchestration) {
    case 'plan-execute': return runPlanExecute(input)
    case 'self-repair':  return runSelfRepair(input)
    case 'standard':
    default:             return callClaudeStandard(input)
  }
}
```

**호환**: `orchestration` 이 undefined 이면 기존 동작 유지. Judge 는 `orchestration` 없이 호출하므로 영향 없음.

## STEP 3-3: `composeRuntime` 이 orchestration 전달 `AI`
`runtime.orchestration = getCard(build.orchestration)?.orchId ?? 'standard'`.

## STEP 3-4: `BenchService.run` 이 runtime.orchestration 을 callClaude 로 전달 `AI`

## STEP 3-5: 스모크 테스트 — plan-execute `AI`
`set-1-oracle` 에 `orchestration=inv-o-plan-execute` 장착 빌드로 호출.
**기대**: enhanced.iterations ≥ 2, text 응답에 "plan" 흔적 없이 최종 답만. 2-phase 동작 확인.

---

# Day 4 — Self-Repair orchestration (3h)

## STEP 4-1: `orchestration/self-repair.ts` 작성 `AI`
```ts
export async function runSelfRepair(input: ClaudeCallInput): Promise<ClaudeCallResult> {
  const first = await callClaudeStandard(input)

  // Quick validator — JSON parse + non-empty check. Task-specific finer
  // validation happens in evaluator; this is just coarse triage.
  const looksValid = validateAnswer(first.text, input.system)
  if (looksValid) return first

  // Retry: append the first answer + a critique + retry instruction
  const retryMessages = [
    ...input.messages,
    { role: 'assistant', content: first.text },
    { role: 'user', content: 'Review your previous answer and fix any violations of the instructions.' },
  ]
  const retry = await callClaudeStandard({ ...input, messages: retryMessages })
  return {
    ...retry,
    iterations: first.iterations + retry.iterations,
    latencyMs: first.latencyMs + retry.latencyMs,
    toolCalls: [...first.toolCalls, ...retry.toolCalls],
    usage: combineUsage(first.usage, retry.usage),
  }
}

function validateAnswer(text: string, system?: string): boolean {
  if (!text.trim()) return false
  // 완화된 JSON 탐지 — 어떤 JSON 요구 문구든 트리거
  if (/json/i.test(system ?? '')) {
    try { JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, '').trim()) }
    catch { return false }
  }
  return true
}
```

## STEP 4-2: 스모크 테스트 `AI`
`set-2-hunter` 에 `orchestration=inv-o-self-repair` · `skill=json-strict` 없이 호출 → 답이 prose 섞여 올 가능성 있음. 1회 retry 후 JSON 만 남는지 확인.

**기대**: retry 로그에 "2 iterations total" · 최종 text 가 parseable JSON.

---

# Day 5 — Evaluator 3종 + Seed 업데이트 (3h)

## STEP 5-1: Marketplace 시드에 함정 레코드 추가 `AI`
`apps/api/src/modules/bench/seed/marketplace.seed.json` 에 3 개 추가:
```json
{"id":"gram-06","title":"LG Gram 16\" 2024 — Sealed (Open box refurb)","price":555,"seller":"refurb_hub","posted_at":"...","sealed":true,"brand":"LG","model":"Gram 16"},
{"id":"gram-07","title":"LG Gram 16\" 2023 — Sealed","price":599,"seller":"used_gear_store","posted_at":"...","sealed":true,"brand":"LG","model":"Gram 16"},
{"id":"gram-08","title":"LG Gram 16\" 2024 — Sealed","price":610,"seller":"refurb_paradise","posted_at":"...","sealed":true,"brand":"LG","model":"Gram 16"}
```

**조건**: price < 700, sealed=true 는 통과. 하지만 seller 에 "refurb"/"used" 포함 → SET 5 에서는 제외되어야 정답.
**ground truth 상위 3** (seller clean 기준): 여전히 `gram-01/02/03`.

## STEP 5-2: karma-v2.md 일부 필드 제거 `AI`
Monthly contribution 과 perks 섹션을 **의도적으로 삭제**. revenue share % 만 남김.

## STEP 5-3: `set4-quant.evaluator.ts` `AI`
메트릭:
- JSON parse pass
- `assets.length === 3`
- `assets[*].sym` 이 ["BTC","ETH","SOL"] 포함
- 각 자산 `price` 의 CoinGecko truth 대비 error %
- `biggest_mover.sym` 이 실제 최대 절대변동 자산과 일치
- citation count (각 자산에 source 또는 captured_at)

## STEP 5-4: `set5-strict-hunter.evaluator.ts` `AI`
메트릭:
- JSON parse pass
- listing[*].id 가 DB 실존
- **constraint pass**: seller 에 /refurb|used/i 없음 AND price<700 AND sealed=true
- recall@3 vs ground truth (`gram-01/02/03`)
- invented count (DB 없는 id)

## STEP 5-5: `set6-grounded.evaluator.ts` `AI`
메트릭:
- 정답 key fact regex: `/70[^0-9]*%/` (Platinum) + `/30[^0-9]*%/` (Bronze)
- revenue_gap `/40[^0-9]*p?p?/`
- doc citation count `[doc:*]` 매치 수
- **abstention**: `/missing:\s*(monthly|contribution|perk)/i` 포함 여부 — flag 2/2 가 full score
- LLM judge: 답변 중 karma-v2.md 에 없는 주장 비율

## STEP 5-6: Evaluator registry 확장 `AI`
`apps/api/src/modules/bench/evaluators/index.ts` 에 3 신규 추가. `getEvaluator(id)` 반환.

---

# Day 6 — Task 정의 + /run 통합 (2h)

## STEP 6-1: `set-definitions.ts` 에 3 엔트리 추가 `AI`

`BenchSetDefinition` 에는 `task`, `systemPrompt`, `skills`, `memoryMode`, `tools`, `evaluatorId`, `evalCriteria` 필드가 있음. 각 필드 채우는 방식:

- `task` — 지침서 §4 의 고정 task 문구
- `systemPrompt` — **`/compare` (preset preview) 에서만 사용**. `/run` 은 build 의 prompt 카드에서 가져옴. 참조용으로 대표 문구를 넣되 `/run` 흐름 무시됨
- `skills` / `tools` / `memoryMode` — UI "Suggested tool / memory" 칩 용. `/run` 영향 없음
- `evaluatorId` — `'set-4-quant'` / `'set-5-strict-hunter'` / `'set-6-grounded'`
- `evalCriteria` — 지침서 §7-4 의 신규 `kind` 포맷 사용

## STEP 6-2: `EvalCriteria` union 확장 + `captureGroundTruth` 분기 `AI`

**(1)** `set-definitions.ts` 의 `EvalCriteria` union 에 3 kind 추가 (지침서 §7-4 참조).

**(2)** `bench.service.ts::captureGroundTruth()` 의 switch 에 3 case 추가:
- `kind: 'quant-multi'` → `captureOracleGroundTruth(symbols)` 재사용, symbols 배열만 `["BTC","ETH","SOL"]`
- `kind: 'strict-hunter'` → `captureHunterGroundTruth(expectedIds, requiredFields, filter)` + sellerBlocklist 추가 필터
- `kind: 'grounded-abstain'` → `capturePolicyGroundTruth(expectedDocIds, keyFacts)` + expectedMissing 주입

## STEP 6-3: curl 스모크 — 3 신규 세트 `AI`
정답 빌드로 각 세트 1회씩 실행, 응답 스키마 + 메트릭 방향성 확인.

**기대**:
- SET 4: schema pass 1, asset count 3, avg price err <2%
- SET 5: all-constraints pass 3/3, invented 0, recall 3/3
- SET 6: key facts 2/2, missing flagged 2/2, citations ≥4

---

# Day 7 — 프론트 카드 확장 + 탭 (1h)

## STEP 7-1: `workshop-mock.ts` 에 10 신규 카드 반영 (Day 1 의 연장) `AI`
(이미 Day 1-4 에서 처리됨 — 그대로 작동 확인만)

## STEP 7-2: `BeforeAfterPreview` 탭 6개 노출 `AI`
`fetchBenchSets()` 응답에 set-4/5/6 이 포함되면 자동으로 탭 늘어남 — 별도 프론트 코드 변경 없이 동작. 확인만.

## STEP 7-3: SET_META 태그 UI 확인 `AI`
신규 3 프롬프트 · 7 스킬 · 3 오케스트 카드가 setTag 뱃지 제대로 표시되는지.

## STEP 7-4: `AppliedSlotsBanner` 를 `skillsActive` 기준으로 전환 `AI`
`apps/web/app/start/workshop/page.tsx` 의 `AppliedSlotsBanner`:
- 기존: `applied.skillsIgnored > 0` 기준으로 "ⓘ N skill equipped — not yet wired (Phase 2)" 표시
- 변경: `applied.skillsActive > 0` 이면 "✓ N skill active" 표시, `skillsIgnored` 조건 제거
- 기존 `AppliedSlots` 타입에 `skillsActive?: number` 추가

`skillsIgnored` 는 타입에서 제거하지 말 것 (백엔드 응답에 여전히 존재, 0).

**기대**: 인벤토리에서 22 카드 전부 보임. 모든 슬롯 drop 가능. 기존 시드 프리셋 + 신규 프리셋 모두 동작. skill 장착 시 배너에 skillsActive 표시.

---

# Day 8 — 리허설 (21 single-slot removal tests) (3h)

## STEP 8-1: 테스트 매트릭스 실행 `사용자+AI`
각 세트 · 각 슬롯 단일 제거 테스트 → 전용 메트릭이 실제로 떨어지는지 확인.

| 세트 | 슬롯 | 전용 메트릭 | 기대 drop |
|---|---|---|---|
| SET 4 | Prompt | JSON schema | pass → fail |
| SET 4 | MCP | price error | <1% → unbounded |
| SET 4 | Decomp | asset count | 3 → 1~2 |
| SET 4 | JSON Strict | schema | pass → fail |
| SET 4 | Citation | citation/asset | 3 → 0 |
| SET 4 | Plan-and-Execute | asset count | 3 → 1~2 |
| SET 4 | Memory | biggest_mover 정확도 | 100% → random |
| SET 5 | (7 슬롯 각각) | all-constraints pass | 3/3 → <3/3 |
| SET 6 | (7 슬롯 각각) | 각 전용 메트릭 | 기획 수치 |

**호출량 실측:**
- 21 `/run` 호출 (각 테스트 1회)
- 각 `/run` 내부 = baseline(1) + enhanced(1~3 calls depending on orch) + judge(0~1 for SET 6)
- 총 Claude API calls ≈ **50~80**. Anthropic 레이트리밋 (분당 수백 RPM) 여유.
- CoinGecko: 심볼 3개 × 60초 캐시 → 첫 호출 후 모두 hit. rate limit 걸릴 일 없음.
- 소요 시간 ~10~15분 (순차 실행 기준).

## STEP 8-2: 미반영 슬롯 교정 `AI`
drop 이 안 보이는 슬롯은 promptSuffix 또는 orch 로직 강화. 필요 시 task 문구 미세 조정.

## STEP 8-3: 3 세트 각 5 회 안정성 테스트 `AI`
- SET 4/5/6 각각 정답 빌드로 5 회 호출 → 메트릭 일관성 확인
- variance 가 크면 temperature=0 확인, task 문구 모호성 제거

---

# Day 9 — 배포 + 최종 검수 (2h)

## STEP 9-1: 전체 TS 체크 `AI`
`apps/api` · `apps/web` 양쪽 `tsc --noEmit` 깨끗한지.

## STEP 9-2: dokploy 배포 `사용자`
commit · push · dokploy 재배포. 프로덕션 URL 에서 6 세트 전부 돌려봄.

## STEP 9-3: 데모 플로우 녹화 (optional) `사용자`
SET 4 · 5 · 6 각 빌드 정답 장착 → 결과 숫자 스크린샷.

## STEP 9-4: 최종 체크리스트 `사용자`
→ `3-checklist-table.md` 모든 항목 green.

---

## 트러블슈팅 팁

- **Plan-and-Execute 가 응답 길어짐**: phase B 의 `maxTokens` 를 500 정도로 제한. 너무 짧으면 truncation 발생
- **Self-Repair 무한 retry**: validator 가 너무 엄격하면 루프. max 1 retry 하드 제한
- **Skill suffix 가 무시됨**: suffix 가 너무 추상적이면 Claude 가 따르지 않음 — 명령형 + 예시 포함하게 재작성
- **Abstention 안 함**: system prompt 에 `respond EXACTLY "missing: <field>"` 처럼 문자열 명시해야 Claude 가 따름
- **CoinGecko 429**: Day 2 캐시 유지됨. 연속 테스트 시 60초 간격 또는 `COINGECKO_API_KEY` 등록
- **LLM judge 흔들림**: temperature=0, schema 엄격하게 요구

---

## Phase 2 완료 기준

- 22 카드 전부 인벤토리 노출 + 드래그 가능
- 6 세트 모두 `/v1/kaas/bench/run` 에서 동작
- 21/21 단일-슬롯-제거 테스트 통과 (전용 메트릭이 실제로 떨어짐)
- 3 세트 각 5 회 안정성 통과 (메트릭 variance 허용 범위)
- TS clean, 프로덕션 배포 완료
