# Cherry Equip (Phase 2) — 진행 로그

세션별로 "무엇을 어디까지 했는지" 기록. 다음 세션에서 이 로그만 읽고 이어갈 수 있게.

포맷:
```
## YYYY-MM-DD HH:MM — <작업자> — <세션 제목>
- 완료: ...
- 이슈: ...
- 다음: ...
```

---

## 2026-04-24 — AI — 기획 문서 작성

- 완료:
  - `apps/docs/equip/` 폴더 생성
  - `1-work-guidelines.md` — 3 세트 (SET 4 Quant / SET 5 Strict Hunter / SET 6 Grounded) 완전 스펙 + 신규 12 카드 (7 skill + 3 orch + 3 prompt, 기존 MCP/Memory 재사용) + 아키텍처 변경 (composeRuntime skill-suffix append, callClaude orchestration dispatcher, Plan-and-Execute 2-phase, Self-Repair retry)
  - `2-implementation-guide.md` — Day 0 ~ Day 9 단계별 STEP 표기 + 담당자 + 기대 결과. Day 8 에 21 단일-슬롯-제거 리허설 매트릭스 명시
  - `3-checklist-table.md` — Day 별 체크리스트 + Day 8 리허설 매트릭스 + 성과 목표 수치
  - `4-progress-log.md` — 이 파일 (템플릿)
- 선행 조건: `apps/docs/bench/` Phase 1 완료 상태 (3 슬롯 wiring 검증됨)
- 이슈: 없음
- 다음: 사용자 기획 승인 → Day 0 사전 확인 후 Day 1 실행 (Skill 7장 + Prompt 3장 등록)

---

## 2026-04-24 — AI — 기획 검수 + 패치 (v2)

사용자와 함께 꼼꼼한 검토 · 결정 · 문서 수정.

**확정 사항:**
- **SetTag 확장** — `oracle | hunter | policy | quant | strict | grounded` 6 값
- **setTag 필드 배열화** — 공유 카드는 여러 태그 소속 가능 (`SetTag[]`). 기존 9 카드는 `["oracle"]` 형태로 마이그레이션
- **`inv-o-standard` 유지** — UX 완결성용 · 기능상 no-op (orchestration 슬롯 비운 것과 동일)
- **`skillsIgnored` 하위호환** — 응답 스키마에 남김 (Phase 2 완료 후 항상 0). 프론트 `AppliedSlotsBanner` 호환 유지
- **3슬롯 · 7슬롯 동시 지원** 원칙 명시 — `/run` 엔드포인트는 어떤 조합도 허용, 점수는 장착량에 따라 자연 변동

**적용된 문서 수정 (총 13개):**
1. §3-2 3/7슬롯 병행 명시
2. §3-5 SetTag widen + 배열 형식 신규 섹션
3. §6 Skills 표 setTag 을 배열로 (`["quant","strict"]` 등)
4. §6 Orchestration 에 `inv-o-standard` 역할 명시
5. §6 기존 카드 마이그레이션 표 · SET_META 6 엔트리 표 추가
6. §7-1 `skillsActive` 신규 + `skillsIgnored` 하위호환 명시
7. §7-2 `callClaude` export 유지 · 내부만 분리 명시
8. §7-4 `EvalCriteria.kind` 3 신규 case 명시
9. §7-5 set.systemPrompt 는 `/compare` 전용 · `/run` 은 build 기반 명시
10. §9 최악 케이스 비용 ~$0.20 추가
11. Day 1 STEP 1-1 `CardType` union 확장 명시
12. Day 1 STEP 1-4/5 재작성 — 배열 마이그레이션 + SetBadge 렌더러
13. Day 2-1 `skillsActive` + `skillsIgnored: 0` 하위호환
14. Day 3-2 `callClaude` 이름 유지 원칙 명시
15. Day 4-1 validator 정규식 완화 (`/json/i`)
16. Day 6-1/2 set.systemPrompt vs `/run` 분리 + EvalCriteria union 확장
17. Day 7-4 신설 — `AppliedSlotsBanner` `skillsActive` 전환
18. Day 8 API 호출량 실측 (50~80 calls, 레이트리밋 여유)
19. Day 1 머릿말에 중간 상태 경고 추가

**미결 → 모두 해결**:
- 공유 skill 태그 → 배열로 결정
- `skillsIgnored` → 하위호환 유지
- `inv-o-standard` → 유지

**다음:** Day 0 착수 대기. 사용자 최종 승인 후 진행.

---

## 2026-04-24 — AI — Day 0 ~ Day 2 실행

**Day 0 — 사전 확인**
- 기존 4000 포트는 stale dist (404). 4001에 fresh Nest 인스턴스 부팅 → `/bench/sets` 3개 반환 확인. Phase 1 정상.
- git: `apps/docs/equip/` 만 untracked, 나머지 깨끗.

**Day 1 — 카드 등록**
- 백엔드 `card-registry.ts`:
  - `CardType` union → 5 값 (prompt/mcp/skill/orch/memory)
  - `OrchestrationId = 'standard' | 'plan-execute' | 'self-repair'` 신규
  - `SkillCardImpl` · `OrchestrationCardImpl` 인터페이스 추가, `CardImpl` 유니온 확장
  - 13 신규 엔트리 등록: Prompts 3 (quant/strict-hunter/grounded) · Skills 7 (decomp/json-strict/citation/constraint-sat/self-validate/multihop/abstention) · Orch 3 (standard/plan-execute/self-repair)
- 프론트 `workshop-mock.ts`:
  - `SetTag` union 6 값으로 확장
  - `SET_META` 3 엔트리 추가 (quant 🜔 purple / strict 🜍 orange / grounded 🜚 green)
  - `setTag` 필드: 단일 `SetTag` → `SetTag[]` 배열로 변환
  - 기존 9 카드 전부 `["oracle"]` 형태로 마이그레이션
  - 13 신규 카드 inventory 에 추가 (공유 카드 2 태그: `inv-s-json-strict: ["quant","strict"]`, `inv-s-citation: ["quant","grounded"]`, `inv-o-plan-execute: ["quant","grounded"]`)
  - storage key `v7 → v8`
- 프론트 `kaas-workshop-panel.tsx`:
  - `InventoryCard` — setTag 배열 순회 렌더 (공유 카드는 뱃지 2개 나란히)
  - `EquipSlot` — compact 뱃지는 첫 태그만

**Day 2 — composeRuntime skill 합성**
- `compose-runtime.ts`:
  - skillA/B/C 카드 조회 → `promptSuffix` 를 base prompt 뒤에 `\n\n` 으로 이어붙임
  - 중복 suffix dedup
  - `orchestrationId` 필드 신규 (build.orchestration 에서 파생, 기본 'standard')
  - `appliedSlots`:
    - 신규 `skillsActive: number` (실제 유효 skill 수)
    - 신규 `orchestrationActive: boolean`
    - 기존 `skillsIgnored` / `orchestrationIgnored` **제거 안 함** — 프론트 배너 하위호환. Phase 2 후 항상 0/false
- 프론트 `bench-api.ts` · `AppliedSlotsBanner`:
  - `AppliedSlots` 타입에 `skillsActive?` · `orchestrationActive?` 추가 (optional for backward compat)
  - Banner 표시 로직을 `skillsActive > 0` / `orchestrationActive` 기준으로 전환. "not yet wired" 문구 제거 (Phase 2 들어왔으므로)

**실측 (Day 2-3 smoke)**
| 빌드 | skillsActive | citation count |
|---|---|---|
| A: no skill | 0 | **2** |
| B: +inv-s-citation | 1 | **8** |

→ Citation Discipline skill 의 프롬프트 suffix 가 실제 Claude 응답에 반영 (2→8, 4배). skill 장착이 **측정 가능한 효과** 를 낸다는 증거.

**TS 체크**: apps/api · apps/web 양쪽 clean.

**다음:** Day 3 — Plan-and-Execute orchestration 실구현 (`anthropic.client.ts` dispatcher 분리 + `orchestration/plan-execute.ts` 2-phase call).

---

## 2026-04-24 — AI — Day 3 + Day 4 실행 (Orchestration 실구현)

**Day 3 — Plan-and-Execute**
- `anthropic.client.ts` 재구성:
  - `callClaude` = public dispatcher (orchestration 필드 기반 분기)
  - `callClaudeStandard` = 기존 tool-use 루프, export 유지 (orchestration 모듈이 재사용)
  - `combineUsage` 헬퍼 추가
- `orchestration/plan-execute.ts` 신규:
  - Phase A: tools 없이 `PLAN_SUFFIX` 추가 → plan 생성 (maxTokens 500)
  - Phase B: tools 장착, plan 을 assistant turn 으로 주입 → execute
  - usage · toolCalls · latency · iterations 합산
- `BenchService.run` 이 `runtime.orchestrationId` 를 callClaude 에 전달

**Day 4 — Self-Repair**
- `orchestration/self-repair.ts` 신규:
  - 1차 호출 → validator (JSON 요구 시 parse 체크)
  - 실패 시 critique 메시지 + retry 1회
  - 성공 시 그대로 반환
- `unfence()` 헬퍼: ```json``` 래퍼 제거

**버그 발견 + 수정** (중요)
- `inv-me-none` 의 `maxIterations: 1` 이 tool_use 루프를 첫 API call 에서 종료시켜 tool 실행 못 하고 text 빈값 반환 문제.
- 원인: iteration 1 에서 model이 tool_use 반환 → `iterations >= maxIter` 조건에 걸려 break → tool 실행 전 종료.
- 수정: `inv-me-none` 의 `maxIterations: 1 → 2` — 한 round-trip (tool_use → tool_result → 최종 답변) 최소 보장.
- 단위 테스트도 동일하게 업데이트, 47/47 여전히 통과.

**스모크 결과:**
| 시나리오 | iter | tools | latency | 비고 |
|---|---|---|---|---|
| SET 1 · standard orch | 2 | 1 | ~4.5s | baseline 역할 |
| SET 1 · plan-execute | 3 | 1 | ~6.8s | plan phase +1 iter, +50% latency 정상 |
| SET 2 · self-repair 정상 경로 | 2 | 1 | ~2.9s | validator 통과, retry 안 함 |
| SET 2 · 약한 프롬프트 + self-repair | 2 | 1 | ~3.8s | 이것도 validator 통과 (JSON 어쨌든 생성됨) |

**이슈/관찰:**
- Self-repair 의 retry 경로를 **확실하게** 트리거하는 시나리오가 현재 데이터로 어려움 — Claude Haiku 4.5 가 JSON 요청에 대해 거의 항상 valid JSON 생성. 나중에 SET 5 의 constraint 위반 쪽에서 retry 검증 가능할 것.
- 모든 orchestration 모듈이 동적 import 로 로드됨 (`./orchestration/plan-execute.js` 명시) — nodenext moduleResolution 호환.

**TS 체크**: 양쪽 모두 clean.

**다음:** Day 5 — Evaluator 3종 신규 (set4-quant / set5-strict-hunter / set6-grounded) + Seed 데이터 업데이트 (marketplace 함정 레코드 + karma-v2.md 필드 제거).

---

## 2026-04-24 — AI — Day 5 + Day 6 실행 (세트 3종 엔드투엔드)

**Day 5 — 시드 + 평가기 3종**
- `marketplace.seed.json` 함정 레코드 3건 추가 (gram-06/07/08, seller에 "refurb"/"used" 포함). 조건(sealed + price<700) 통과하지만 SET 5 에서는 제외돼야 정답. 정답 상위 3 (`gram-01/02/03`) 유지 확인.
- `karma-v2.md` 에서 "Tier promotion thresholds" 섹션 삭제 → revenue share % 만 남음. Abstention 테스트 (monthly + perks 는 missing 으로 flag 되어야 정답)
- `set4-quant.evaluator.ts` — JSON schema · asset count · symbols coverage · avg price err % · biggest_mover 정확도 · citation per asset · tool calls
- `set5-strict-hunter.evaluator.ts` — JSON schema · authenticity · all-constraints per record (seller blocklist + sealed + price) · recall@3 · invented count · tool calls
- `set6-grounded.evaluator.ts` — key fact regex (70%/30%) · revenue_gap 40 · doc ID citations · missing flagged (monthly+perks) · LLM judge hallucination % · tool calls
- `evaluators/index.ts` 레지스트리에 3 신규 추가

**Day 6 — 세트 정의 + GT 캡처**
- `set-definitions.ts`:
  - 3 신규 `EvalCriteria` kind (`quant-multi` / `strict-hunter` / `grounded-abstain`)
  - `BenchSetId` union 6 값으로 확장
  - SET_4_QUANT / SET_5_STRICT_HUNTER / SET_6_GROUNDED 세트 정의 (task · systemPrompt · tools · skills · memoryMode · evalCriteria 전부)
  - `BENCH_SETS` 배열에 추가
- `bench.service.ts` `captureGroundTruth` / `summarizeGroundTruth` 를 switch-exhaustive 로 변경, 6 kind 모두 커버
- 기존 Phase 1 `smoke-eval.ts` 는 Phase 2 kind 미지원임을 명시 (HTTP `/run` 이 주 경로)

**버그 수정 (tool matcher)**
- 첫 SET 5 스모크 실패 원인: 태스크 `"LG Gram 16-inch"` 쿼리가 DB `model="Gram 16"` 와 토큰 매치 안 됨 (`-inch`, `"` 문자 때문)
- 수정: `marketplace.tool.ts::normalize()` 헬퍼 추가 — 인치 표기 / 하이픈 / 따옴표 제거 후 토큰 매칭. 재실행 시 정상 동작.

**E2E 스모크 결과 (정답 빌드 기준):**

SET 4 Quant:
| 메트릭 | 값 |
|---|---|
| JSON schema pass | ✓ Yes |
| Asset count | ✓ 3/3 |
| Symbols covered (BTC/ETH/SOL) | ✓ 3/3 |
| Avg price error % | ✓ 0.00% |
| biggest_mover correct | ✓ ETH |
| Citations per asset | ✓ 3/3 |
| iter · tools | 3 · 3 |

SET 5 Strict Hunter (matcher 수정 후):
| 메트릭 | 값 |
|---|---|
| JSON schema pass | ✓ Yes |
| Authenticity | ✓ 3/3 |
| All-constraints pass | ✓ 3/3 (트랩 3건 회피) |
| Recall@3 vs clean DB | ✓ 3/3 |
| Invented | ✓ 0 |
| iter · tools | 4 · 2 |

SET 6 Grounded:
| 메트릭 | 값 |
|---|---|
| Key facts correct | ✓ 2/2 |
| Revenue gap = 40 pp | ✓ Yes |
| Doc ID citations | ✓ 4 |
| Missing flagged (monthly/perks) | ✓ 2/2 |
| Hallucinated facts | ✓ 0% |
| iter · tools | 5 · 7 |

**3 세트 전부 정답 빌드로 퍼펙트 스코어.** Phase 2 핵심 파이프라인 검증 완료.

**TS 체크:** api 전체 clean.

**남은 것:**
- Day 7 — 프론트 탭 6개 노출 확인 (대부분 자동). 신규 3 프롬프트 · 7 스킬 · 3 오케스트 카드 setTag 뱃지 정상 확인
- Day 8 — 21 single-slot-removal 리허설 (각 세트 × 7 슬롯)
- Day 9 — 배포

---
