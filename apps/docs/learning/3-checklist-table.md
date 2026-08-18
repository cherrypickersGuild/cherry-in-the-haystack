# Learning 구현 — 검수 체크리스트

> **2026-08-19 개정 — 역순(화면·콘텐츠 우선 → DB 역주입) Phase에 맞춰 재작성.**
> 범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료. 메모에 담당(사용자/AI)·판정 기준.
> 단계별로 해당 항목을 실행해 에러 0을 확인한 뒤 다음 단계로.

## Phase 0 — 스키마 확정 & 온톨로지 대조
| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 콘텐츠 JSON 스키마 확정(`2-implementation-guide.md` §2) | - | AI 초안 → 사용자 승인 |
| 0-2 Basics 6개 `ontology.node` 매핑표 작성 | - | AI · 로컬 GraphDB에 실제 라벨로 질의해 **존재 확인**(추정 금지) |
| 0-3 `evaluation-systems` 매핑 재검토(`AutomaticMetric` vs 상위 `EvaluationMetric`) | - | AI 제안 → 사용자 결정 |
| 0-4 갈림길 G1(추론 범위 `infer=false`)·G2(매핑 방식) 결정 | - | 사용자 |
| 0-5 [게이트] 스키마 + 매핑표 승인 | - | 사용자 |

## Phase 1 — RAG 버티컬 슬라이스
| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 `public/learning/concepts/rag.json` 작성(4섹션 전부) | - | AI · **모든 cherry에 출처(source·locator) 존재**가 통과 조건(C4) |
| 1-2 `concept-reader-page.tsx` → `slug` prop + JSON fetch 리팩터 | - | 하드코딩 상수 3개 제거 |
| 1-3 **레이아웃 보존 검증** — 리팩터 전/후 화면 스냅샷 대조 | - | 오라클 = 수정 전 스크린샷 |
| 1-4 사이드바 `RAG` 클릭 → 개념 페이지 렌더 실동작 | - | 브라우저 확인 1회 이상 |
| 1-5 `tsc --noEmit` 신규 에러 0 | - | 기존 무관 8건(kaas) 제외 |
| 1-6 JSON 스키마 검증(필수 필드 누락 0, `ontologyNode` 전부 기입/`null` 명시) | - | node 스크립트 |
| 1-7 **`ontology-gap/rag.md` 생성** | - | AI · **필수(C6)** — 없으면 완료 아님 |
| 1-8 **`ontology-gap/0-summary.md` 재계산** | - | AI |
| 1-9 갭 리포트 `제안` 검토 → 승인/반려 표시 | - | 사용자 |
| 1-10 `4-progress-log.md` 한 줄 기록 | - | AI |
| 1-11 [게이트] 화면 전/후 대조 + 콘텐츠 품질 리뷰 + 갭 리포트 검토 | - | 사용자 |

## Phase 2 — Basics 나머지 5개 콘텐츠
| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 5개 JSON 작성(prompting·fine-tuning·agents·embeddings·evaluation) | - | AI 초안 + 사용자 검수 |
| 2-2 출처 커버리지 — cherry 중 출처 없는 항목 **0건** | - | 스크립트 검사(C4) |
| 2-3 `childConcepts[].ontologyNode` 중 기존 302개와 **중복 신설 0건** | - | 스크립트로 라벨 대조(C3) |
| 2-4 6개 페이지 전부 렌더 확인 | - | 브라우저 |
| 2-5 **개념마다 갭 리포트 생성**(5개 각각, DoD 6단계) | - | AI · **몰아서 생성 금지** |
| 2-6 누적 `0-summary.md` 최신화 + 커버리지 산출 | - | AI |
| 2-7 [게이트] 콘텐츠 품질 리뷰 + **누적 요약 검토(= 보완 명세서 초안)** | - | 사용자 |

## Phase 3 — 라우팅 통합 & 퍼블리싱
| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 Basics 6개 `HandbookPlaceholder` → 개념 페이지 라우팅 | - | `app/page.tsx` switch |
| 3-2 Concept Reader/토픽 페이지 **동일 컴포넌트** 재사용 | - | 결정 §4-1-3 |
| 3-3 고아 메뉴 0 · 죽은 case 0 | - | node 교차검증(기존 스크립트 재사용) |
| 3-4 죽은 "This Week's Highlight" 링크 정리 | - | `handbook-placeholder.tsx` |
| 3-5 [게이트] 퍼블리싱 승인 → **이 시점 JSON = 역주입 기준선** | - | 사용자 |

## Phase 4 — 역주입 (JSON → DB) 🔴 쓰기
| 항목 | 상태 | 메모 |
|---|---|---|
| 4-0 [게이트] **쓰기 승인** — 공유 프로덕션 DB(작업지침 §7) | - | 사용자 · 승인 없이 실행 금지 |
| 4-1 **입력 = `0-summary.md`의 `승인`된 제안만** | - | 미검토·반려 항목 제외 |
| 4-2 JSON → TTL 생성 스크립트 | - | `status: new`만 노드 신설 |
| 4-2 **로컬 컨테이너에서 먼저 검증** 후 반영 | - | 프로덕션 직행 금지 |
| 4-3 handbook 시드(`concept`·`paragraph_concept_link`·`topic`) | - | `cherries[].locator`로 청크 역매칭 |
| 4-4 `content.concept_page` 발행 — **KaaS와 네임스페이스 충돌 검토** | - | 현재 KaaS가 이 테이블 사용 중 |
| 4-5 **역주입 정합 검증** — `related-concepts` 응답이 JSON과 동일한가 | - | 대조 스크립트, 불일치 0 |
| 4-6 롤백 절차 확보 | - | 사전 백업 경로 기록 |

## Phase 5 — API 전환 & 관계 확장
| 항목 | 상태 | 메모 |
|---|---|---|
| 5-1 화면 데이터 소스 JSON → API 전환 | - | |
| 5-2 **JSON 폐기**(단일 정본 확보) | - | C5 |
| 5-3 `prerequisite`/`extends`/`related` 서술어 추가 → 5종 배지 복원 | - | `add_relations.py` |
| 5-4 `config.ts:57` 죽은 IP 하드코딩 제거(`.env` 전용) | - | 갈림길 G3 |

## 성과 목표 (완료 기준)
- **Phase 3 시점**: Basics 6개 토픽 클릭 시 **4섹션 개념 페이지가 실제 콘텐츠로** 렌더(placeholder 아님). 모든 Cherry에 출처 존재. 레이아웃은 Concept Reader 정본과 일치.
- **Phase 5 시점**: 화면이 API로 구동되고 JSON은 폐기됨. `related-concepts` 결과가 퍼블리싱된 내용과 일치.
- **목표 ② (동등)**: 개념 12개 각각에 대해 `ontology-gap/<slug>.md`가 존재하고, 누적 `0-summary.md`가 **GraphDB 보완 명세서**로 성립한다(신설 목록·별칭 목록·관계 추가 목록·커버리지).
- 전 구간: 하드코딩 콘텐츠 0 · 출처 없는 Cherry 0 · 중복 온톨로지 노드 0 · **갭 문서 누락 0**.
