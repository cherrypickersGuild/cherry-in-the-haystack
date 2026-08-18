# Learning 구현 — 검수 체크리스트

> 범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료. 담당(사용자/AI)·판정 기준을 메모에.
> 단계별로 이 표의 항목을 실행해 에러 0을 확인한 뒤 다음 단계로.

## Phase 0 — 백엔드 계약 실측
| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 `/api/writer-agent/related-concepts?topic=rag` 실호출 응답 캡처 | - | AI · 응답 JSON 파일로 저장(parents/children 실물) |
| 0-2 `/api/writer-agent/input` 입력 dto·응답 캡처 | - | AI · evidence 구조 확인 |
| 0-3 **합성 콘텐츠(Overview/Cherries/References) 발행 저장소 존재 여부** | - | AI · handbook/concept 테이블 조사 → 있으면 서빙 경로, 없으면 "발행 계층 없음" 결론 |
| 0-4 UI 12개 id ↔ `handbook.topic`/`subtopic` 매핑표 | - | AI · DB 실제 topic 행 조회 |
| 0-5 [게이트] 발행 계층 유무 + 매핑 보고 | - | 사용자 승인 |

## Phase 1 — Concept Reader 데이터화 (버티컬 슬라이스)
| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 `ConceptReaderPage` 하드코딩 제거 → `conceptId` prop + fetch | - | AI |
| 1-2 Child Concepts를 `/related-concepts` 실데이터로 렌더 | - | 부모/자식 카드 |
| 1-3 한 개념(rag) 전 계층 관통(탭→API→렌더) 실동작 | - | 브라우저 스샷 1개 이상 |
| 1-4 `tsc --noEmit` 신규 에러 0 | - | 기존 무관 8건 제외 |
| 1-5 [게이트] 화면 전/후 대조(레이아웃 보존) | - | 사용자 승인 |

## Phase 2 — Basics/Advanced 라우팅 통합
| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 12개 토픽 `HandbookPlaceholder` → 개념 페이지 라우팅 | - | `app/page.tsx` switch |
| 2-2 Concept Reader/토픽 페이지 동일 컴포넌트 재사용 | - | 1-지침 §4-2 결정 반영 |
| 2-3 죽은 "This Week's Highlight" 링크 정리 | - | `handbook-placeholder.tsx` |
| 2-4 고아 메뉴/죽은 case 0 (node 교차검증) | - | |

## Phase 3 — 사이드 패널 데이터화
| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 Learning Roadmap SVG 관계 데이터화 | - | 부모/자식 |
| 3-2 기여자·메타 연동 | - | |

## Phase 4 — (후속) 온톨로지 관계 확장 + 승격
| 항목 | 상태 | 메모 |
|---|---|---|
| 4-1 `prerequisite/extends/related` 관계 추가(add_relations.py) | - | 5종 표현 복원 |
| 4-2 승격 플로우(Advanced→Basics) 반영 | - | PRD §1 |

## 성과 목표 (완료 기준)
- Basics/Advanced 토픽 클릭 시 **개념 페이지(4섹션)가 실제 데이터로** 렌더(placeholder 아님).
- Child Concepts가 GraphDB 관련개념을 반영(클릭 이동 가능).
- 하드코딩 상수 0(콘텐츠는 백엔드/props). 화면 레이아웃은 Concept Reader 정본과 일치.
