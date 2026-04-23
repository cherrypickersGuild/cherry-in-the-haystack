# Cherry Equip (Phase 2) — 체크리스트

범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료

---

## Day 0 — 사전 확인

| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 Phase 1 `/run` 정상 호출 | - | curl set-1-oracle |
| 0-2 git clean + 작업 브랜치 | - | 사용자+AI |
| 0-3 예산 확인 ($3~5) | - | 사용자 |

## Day 1 — Skill 7장 + Prompt 3장

| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 `CardImpl` 유니온에 skill / orchestration 타입 추가 | - | TS |
| 1-2 7 skill 카드 `CARD_REGISTRY` 등록 | - | promptSuffix 지침서 일치 |
| 1-3 3 신규 prompt 카드 등록 | - | task 와 호응 |
| 1-4 프론트 `workshop-mock.ts` 에 10 엔트리 + setTag | - | 저장키 v7→v8 |
| 1-5 SET_META 태그 확인 (재사용 vs 확장) | - | 선택 결정 |
| 1-6 커밋 | - | feat(equip): cards v0 |

## Day 2 — Skill composition

| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 `composeRuntime` skill suffix 결합 | - | dedup 포함 |
| 2-2 appliedSlots.skillsActive 추가 | - | UI 호환 유지 |
| 2-3 스모크 — skill 효과 확인 (citation 카드 유/무) | - | 차이 확인 |

## Day 3 — Plan-and-Execute

| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 `orchestration/plan-execute.ts` | - | 2-phase call |
| 3-2 `callClaude` dispatcher | - | orchId 분기 |
| 3-3 composeRuntime → runtime.orchestration | - | |
| 3-4 BenchService.run 이 orchestration 전달 | - | |
| 3-5 스모크 — SET 1 with plan-execute | - | iter ≥ 2 |

## Day 4 — Self-Repair

| 항목 | 상태 | 메모 |
|---|---|---|
| 4-1 `orchestration/self-repair.ts` | - | retry 1회 제한 |
| 4-2 validator (JSON parse + schema 힌트) | - | 재시도 조건 |
| 4-3 스모크 — SET 2 json 검증 | - | retry 로그 확인 |

## Day 5 — Evaluators + Seed

| 항목 | 상태 | 메모 |
|---|---|---|
| 5-1 marketplace 함정 레코드 3건 추가 | - | seller refurb/used |
| 5-2 karma-v2.md 일부 필드 제거 | - | 사용자 승인 |
| 5-3 `set4-quant.evaluator.ts` | - | schema + 3 assets + biggest_mover |
| 5-4 `set5-strict-hunter.evaluator.ts` | - | constraint pass + recall |
| 5-5 `set6-grounded.evaluator.ts` | - | key facts + missing flag + judge |
| 5-6 Evaluator registry 확장 | - | getEvaluator 등록 |

## Day 6 — Task 정의 + /run

| 항목 | 상태 | 메모 |
|---|---|---|
| 6-1 `set-definitions.ts` 에 set-4/5/6 | - | |
| 6-2 captureGroundTruth 분기 | - | 3 세트 모두 |
| 6-3 curl 스모크 — 3 신규 세트 정답 빌드 | - | 방향성 통과 |

## Day 7 — 프론트 탭 + 카드

| 항목 | 상태 | 메모 |
|---|---|---|
| 7-1 Day1-4 반영된 프론트 작동 확인 | - | 22 카드 visible |
| 7-2 BeforeAfterPreview 탭 6개 자동 노출 | - | fetchBenchSets 기반 |
| 7-3 setTag 뱃지 UI 정상 | - | |

## Day 8 — 리허설 (핵심)

| 세트 | 슬롯 | 전용 메트릭 | drop 확인 |
|---|---|---|---|
| SET 4 | Prompt | JSON schema | - |
| SET 4 | MCP | price error | - |
| SET 4 | Decomp | asset count | - |
| SET 4 | JSON Strict | schema pass | - |
| SET 4 | Citation | citations/asset | - |
| SET 4 | Plan-Execute | asset count | - |
| SET 4 | Memory | biggest_mover | - |
| SET 5 | Prompt | JSON | - |
| SET 5 | MCP | authenticity | - |
| SET 5 | Constraint-Sat | all-constraints pass | - |
| SET 5 | JSON Strict | schema | - |
| SET 5 | Self-Validate | all-constraints pass | - |
| SET 5 | Self-Repair | all-constraints pass | - |
| SET 5 | Memory | (영향 ≈ 0) | - |
| SET 6 | Prompt | JSON 형식 | - |
| SET 6 | MCP | doc citations | - |
| SET 6 | Multi-hop | key facts | - |
| SET 6 | Citation | doc IDs | - |
| SET 6 | Abstention | missing flagged | - |
| SET 6 | Plan-Execute | key facts completeness | - |
| SET 6 | Memory (retrieval) | judge hallucination | - |

**각 세트 × 5회 안정성**

| 세트 | 회차 | 정답 빌드 | 메트릭 일관성 |
|---|---|---|---|
| SET 4 | 1-5 | - | - |
| SET 5 | 1-5 | - | - |
| SET 6 | 1-5 | - | - |

## Day 9 — 배포

| 항목 | 상태 | 메모 |
|---|---|---|
| 9-1 전체 `tsc --noEmit` clean | - | api + web |
| 9-2 dokploy 재배포 | - | 사용자 |
| 9-3 프로덕션 6 세트 curl 확인 | - | |
| 9-4 최종 체크리스트 전체 green | - | 사용자 |

---

## 성과 목표 (Phase 2 완료 기준)

- 22 카드 인벤토리 표시 + 전 슬롯 드래그 가능
- `/v1/kaas/bench/sets` 에 6 set 반환
- SET 4: 정답 빌드 `schema pass=1 · assets=3 · price_err<2% · biggest_mover 100% · citations≥3` (5회 모두)
- SET 5: 정답 빌드 `schema=1 · all-constraints=3/3 · recall@3=3/3 · invented=0` (5회 모두)
- SET 6: 정답 빌드 `key_facts=2/2 · revenue_gap=40 ✓ · citations≥4 · missing_flagged=2/2 · hallucination<5%` (5회 모두)
- 21 single-slot-removal 테스트 전부 "전용 메트릭이 떨어짐" 확인됨
- 프로덕션 배포 완료, 공개 URL 에서 6 세트 동작
