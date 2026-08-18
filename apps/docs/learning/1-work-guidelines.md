# Learning 구현 — 작업 지침 (배경·목표·범위·의사결정)

> 기준일: 2026-08-16 · 대상 브랜치 `deploy`
> Learning(개념 학습: Concept Reader + Basics + Advanced)을 **하드코딩 샘플 → 실제 데이터 연동**으로 구현하기 위한 기획 폴더. 번호식 3종: 본 문서(지침) · `2-implementation-guide.md`(레이아웃·단계) · `3-checklist-table.md`(검증). 참고 자료: `개념온톨로지-GraphDB-조사.md`(이 폴더).
> 상위 정본: `docs/PRD/product-scope.md` §1·§2(4섹션·파이프라인·승격) · `docs/PRD/functional-requirements.md`(Concept/Evidence Layer) · `docs/architecture/handbook-ddl-{redesign,revision}-proposal.md`(Evidence/handbook 스키마). 지도: `base-data/기획문서-참조지도-ND-Learning.md` §3.

---

## 1. 배경

- Learning은 ND(뉴스 큐레이션)와 성격이 다르다 — **책·강의에서 뽑은 "개념(concept)"** 을 4섹션 포맷으로 정리해 보여준다.
- **개념 페이지 4섹션(PRD §1 정본)**: ① Overview ② Cherries(문헌 MECE 요약) ③ Child Concepts(온톨로지 관련개념) ④ Progressive References(MECE 학습경로).
- **콘텐츠 파이프라인(PRD)**: `Curated Sources → Evidence Layer(handbook) → Ontology(GraphDB) → Writer Agent 합성 → 개념 페이지 발행`.

## 2. 현재 상태 (정밀 — 실측)

| 부분 | 상태 |
|---|---|
| Concept Reader (`concept-reader-page.tsx`) | 4섹션 **화면은 완성**(2열: 왼쪽 리딩 4섹션 + 오른쪽 패널), 단 **데이터 하드코딩**(RAG 예시 `CHERRIES`/`CHILD_CONCEPTS`/`REFERENCES` 상수, `READER_CONCEPT_ID="rag"`). 백엔드 미연결. |
| Basics(6)·Advanced(6) 토픽 | `HandbookPlaceholder`("Handbook In Progress") — 제목/설명만. **개념 페이지 화면을 안 씀.** |
| 백엔드 `writer_agent` | 구축됨 — `POST /api/writer-agent/input`(handbook v2 evidence 패키징), `GET /api/writer-agent/related-concepts?topic=`(GraphDB SPARQL, SELF/PARENT/CHILD). `AgentApiKeyGuard`. |
| Ontology 서비스 `idea_to_graph_ontology` | 구축됨 — GraphDB(Ontotext, repo `llm-ontology`) `rdfs:subClassOf` 계층(개념 ~302). ChromaDB 벡터. 상세: `개념온톨로지-GraphDB-조사.md`. |
| **화면 기획 문서** | ⚠️ **전용 문서 없음.** de facto 화면 = `concept-reader-page.tsx` 코드. (외부 "UI & Information Architecture 260415"에 와이어프레임 있으나 리포 밖.) |

## 3. 목표

**하드코딩·placeholder를 걷어내고, Concept Reader 화면을 템플릿으로 삼아 개념 페이지를 실제 데이터로 렌더한다.** Basics/Advanced 토픽도 같은 개념 페이지로 연다.

## 4. 범위 & 갈림길 (착수 전 결정 — S1 게이트)

> ⚠️ 아래는 **사용자 결정 사항**. 임의로 정하지 않는다.

1. **화면 정본**: Concept Reader 코드를 **de facto 정본으로 굳힐지** vs 외부 260415 와이어프레임을 받아 반영할지. (기본 제안: 코드를 정본화 + 필요시 보정.)
2. **컴포넌트 통합**: 지금 `ConceptReaderPage`(독립 메뉴)와 Basics/Advanced(`HandbookPlaceholder`)가 별개다. → **하나의 "개념 페이지" 컴포넌트로 통합**하고 concept id로 파라미터화할지. (기본 제안: 통합.)
3. **Child Concepts 관계 범위**: 샘플 UI는 5종(SUBTOPIC·PREREQUISITE·EXTENDS·RELATED…)인데 **GraphDB는 `rdfs:subClassOf`(부모/자식)만 구현**(`llm:related`는 1개). → ⓐ UI를 부모/자식으로 단순화 vs ⓑ 온톨로지에 관계를 확장. (기본 제안: Phase 1은 ⓐ, 확장은 후속.)
4. **4섹션 콘텐츠 출처(가장 큰 미확인)**: writer_agent는 **Writer Agent에게 evidence를 "공급"** 하는 엔드포인트다. **합성된 4섹션 콘텐츠(Overview 산문·Cherries)가 어디 저장·서빙되는지 미확인** — 개념 페이지용 발행 테이블/엔드포인트 존재 여부를 **Phase 0에서 반드시 확인**. 없으면 그 발행 계층 설계가 선행 과제.

## 5. 제약 / 주의

- 🔴 로컬·프로덕션 같은 Supabase DB 공유 — handbook 스키마 조회는 읽기만, 마이그레이션 극도 주의(작업지침 §7).
- **UI 토픽 id(12개)는 UI 전용** — 토픽 마스터 정본은 DB `handbook.topic`/`handbook.subtopic`(`writer-agent.service.ts`가 `LEFT JOIN handbook.topic` 사용). **id ↔ topic 매핑이 첫 연동 과제.**
- 지어내지 않기 — 콘텐츠는 실제 합성 결과만. 없으면 채우지 말고 상태 표시.
- 변경·커밋은 사용자 허락/지시 후(§5).

## 6. 결과물

- 데이터 연동된 개념 페이지(Concept Reader 템플릿) + Basics/Advanced 라우팅. 상세 단계는 `2-implementation-guide.md`, 검증은 `3-checklist-table.md`.
