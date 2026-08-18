# Learning 구현 — 구현 가이드 (레이아웃 + 단계)

> `1-work-guidelines.md`의 목표를 실제로 구현하는 방법. 레이아웃은 **Concept Reader(`concept-reader-page.tsx`) 화면을 정본**으로 삼는다.

---

## 1. 레이아웃 정본 — Concept Reader 화면 분해

**전체: 2열 구조** (`flex lg:flex-row`). 왼쪽 = 리딩 컬럼(max 700px), 오른쪽 = 사이드 패널(280px, 모바일에선 아래로).

### 1-A. 왼쪽 리딩 컬럼 (개념 본문 = 4섹션)
| 요소 | UI (현재 코드) | 데이터 소스(연동 목표) |
|---|---|---|
| 섹션 배지 | `Basics`/`Advanced` (violet pill) | 개념의 section(basics/advanced) |
| 제목 + `Buy on Market` 버튼 | H1 개념명 + cherry 버튼(→ KaaS 마켓 `onBuyOnMarket(conceptId)`) | 개념명 · concept id |
| 메타 행 | Updated · N sources · Knowledge Team verified · N min read | 개념 메타(갱신일·출처수·기여자·읽기시간) |
| **01 Overview** | 산문 3문단(`prose`) | 합성된 Overview 텍스트 |
| **02 Cherries** | 카드 리스트(🍒 source + body, cherry 좌측 보더) | Evidence Layer(handbook) 근거 스니펫 |
| **03 Child Concepts** | 2열 카드 그리드(관계 TYPE 배지[색] + label + desc, 클릭형) | **GraphDB 관련개념**(`/related-concepts`) |
| **04 Progressive References** | 타임라인(START HERE/NEXT/THEN/DEEP DIVE + title + "What you'll learn" + "Adds") | MECE 참고자료 목록 |

### 1-B. 오른쪽 사이드 패널
| 카드 | UI | 데이터 소스 |
|---|---|---|
| **Learning Roadmap** | SVG 그래프(현재 개념 노드 + Prerequisites + Advanced 박스) + 범례 | GraphDB 관계(부모=prereq, 자식/상위=advanced) |
| **New in Digest** | 관련 신규 항목(Digest 링크) | ND(Digest)와 개념 매칭 — 후순위 |
| **Knowledge Team** | 기여자 아바타 | 개념 기여자(contributors) |

> ⚠️ **관계 표시 갭**: 샘플 Child Concepts/Roadmap은 `SUBTOPIC/PREREQUISITE/EXTENDS/RELATED` 5종을 쓰지만 **GraphDB엔 `rdfs:subClassOf`(부모/자식)만** 있다. Phase 1은 부모/자식으로 매핑(예: 상위=부모, 하위=자식), 5종 표현은 온톨로지 확장 후(Phase 4).

---

## 2. 데이터 소스 매핑 (하드코딩 → 백엔드)

| 4섹션 | 현재(하드코딩 상수) | 연동 대상 | 비고 |
|---|---|---|---|
| Overview 산문 | (JSX 인라인) | **합성 콘텐츠**(발행 저장소) | ⚠️ 발행 계층 존재 여부 Phase 0 확인 |
| Cherries | `CHERRIES[]` | `POST /api/writer-agent/input`(handbook evidence) | evidence를 그대로 or 합성 후 |
| Child Concepts | `CHILD_CONCEPTS[]` | `GET /api/writer-agent/related-concepts?topic=` | 응답 `{matched,parents,children}` |
| Progressive References | `REFERENCES[]` | 합성/큐레이션 참고 목록 | 출처 미확정 → Phase 0 |

---

## 3. 단계별 구현 (버티컬 슬라이스 우선)

### Phase 0 — 백엔드 계약 실측 (코드 짜기 전, 필수)
- `writer-agent.controller.ts`/`writer-agent.service.ts`/`graph-concept.service.ts` 응답을 **실호출로 캡처**(스파이크): `/related-concepts?topic=rag`, `/input`(입력 dto 확인).
- **핵심 질문**: 합성된 **개념 페이지 콘텐츠(Overview/Cherries/References)가 저장·서빙되는 곳이 있나?** (handbook에 발행 테이블? concept 테이블? 없으면 writer_agent가 "재료만" 주는 것 → 발행 계층 설계 선행.)
- `handbook.topic`/`handbook.subtopic` 실제 행을 조회해 **UI 12개 id ↔ topic 매핑표** 작성.
- 산출물: 관측 노트(응답 실물 JSON) + 매핑표. **[게이트]** 발행 계층 유무 보고.

### Phase 1 — Concept Reader 데이터화 (한 개념 관통)
- `ConceptReaderPage`를 **props/fetch 기반**으로 리팩터: 하드코딩 상수 제거 → `conceptId` prop + fetch.
- Child Concepts를 `/related-concepts`로 실연동(부모/자식 → 카드). 나머지 섹션은 Phase 0 결과에 따라(발행 데이터 or evidence).
- 한 개념(rag)으로 **전 계층 관통**(탭→페이지→API→렌더) 성공.

### Phase 2 — Basics/Advanced 라우팅 통합
- Basics/Advanced 토픽 12개를 **`HandbookPlaceholder` → 개념 페이지 컴포넌트**로 전환(`app/page.tsx` switch). concept id로 파라미터화.
- Concept Reader 메뉴와 토픽 페이지가 **같은 컴포넌트** 재사용. (통합 여부는 1-지침 §4-2 결정 따름.)
- `HandbookPlaceholder`의 죽은 "This Week's Highlight" 링크 정리.

### Phase 3 — 사이드 패널 데이터화
- Learning Roadmap SVG를 관계 데이터로 생성(현재 개념 + 부모/자식). 기여자·메타 연동.

### Phase 4 — (후속) 온톨로지 관계 확장 + 승격
- `idea_to_graph_ontology`에 `prerequisite/extends/related` 등 관계 추가(`add_relations.py`) → 5종 표현 복원.
- PRD 승격 플로우(Advanced→Basics, 월 2회차) 반영.

---

## 4. 재사용/원칙
- **레이아웃은 재발명하지 않는다** — Concept Reader 화면 그대로, 데이터만 연결(§검증: 전/후 화면 스냅샷 대조).
- 하드코딩 금지 — 값은 백엔드/props에서. 없으면 상태 표시(지어내기 금지).
- 각 Phase 끝에 `3-checklist-table.md` 해당 항목 실행 후 다음.
