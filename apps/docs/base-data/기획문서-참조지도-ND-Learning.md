# 기획문서 참조 지도 — Newly Discovered & Learning

> 기준일: 2026-08-16
> **"어떤 페이지를 구현/수정하려면 어떤 기획문서를 봐야 하나"** 를 정리한 참조 인덱스. 다음 작업(ND·Learning 확장) 착수 시 여기서 봐야 할 문서를 먼저 찾는다.
> ⚠️ 문서가 **두 위치**에 흩어져 있다: **루트 `docs/`**(상위 기획: PRD·UX·architecture) + **`apps/docs/`**(구현 기획·자료조사·현황·목업). 둘 다 봐야 한다.

---

## 0. 문서 계층 & 읽는 순서

| 계층 | 위치 | 무엇 |
|---|---|---|
| ① 스코프·요구사항 | `docs/PRD/` | 제품 범위·기능요구(무엇을 만드나) — **최상위 정본** |
| ② UX / IA | `docs/ux-design-specification.md`, `docs/ux-design-directions.html`, `apps/docs/plan/frontend-ia-menu-design-plan.md` | 정보구조·메뉴·화면 뼈대(어떤 구조로) |
| ③ feature 구현 기획 | `apps/docs/plan/*`, `apps/docs/<feature>/` | 페이지·데이터 서빙(어떻게) |
| ④ 콘텐츠 데이터 | `apps/docs/content-curation-plan/` | 수집·분류(kind)·재현(자료조사) |
| ⑤ 화면 목업 | `apps/docs/mockups/*.html` | 픽셀 기준 디자인 |
| ⑥ 현황·인수인계 | `apps/docs/base-data/` | 지금 코드 상태 |

**착수 순서:** ① PRD/UX(무엇·왜) → ② IA/menu(구조) → ③ feature 구현 기획(방법) → ④ 자료조사/방법론(데이터) → ⑥ 현황·handoff(지금 상태).

---

## 1. 공통 기반 (ND·Learning 둘 다 먼저 읽는다)

| 문서 | 무엇 |
|---|---|
| `docs/PRD/product-scope.md` | **Content Structure = ① Basics · ② Advanced · ③ Newly Discovered** 세 섹션 정의. 코드 `nd-taxonomy.ts`의 카테고리는 이 PRD(≡ 외부 Cherry Category 260530, "완전 동일")와 동기화된 것. |
| `docs/PRD/functional-requirements.md` · `docs/PRD/index.md` | 기능요구·목차 |
| `docs/ux-design-specification.md` · `docs/ux-design-directions.html`(Design Directions v4) | UX/디자인 방향 |
| `apps/docs/plan/frontend-ia-menu-design-plan.md` ⭐ | **IA/메뉴 설계 정본** — 3개 근거(**UI & Information Architecture 260415**[외부·최古] · `docs/PRD/product-scope.md` · **Cherry Category 260530**[외부·최신])를 **종합**해 ND 4그룹15카테고리 + LEARNING(Concept Reader·Basics·Advanced) 확정. 콘텐츠 태그 기준선 = 최신 Category(260530). 코드 종합·정본 = `nd-taxonomy.ts`. |
| `apps/docs/plan/frontend-menu-implementation-plan.md` | 메뉴 구현 기획 |
| 코드 단일소스 | `apps/web/lib/nd-taxonomy.ts`(메뉴/위계) · `apps/web/components/cherry/sidebar.tsx` · 목업 `apps/docs/mockups/sidebar-mockup.html` |
| 현황 | `apps/docs/base-data/frontend-status-2026-08-16.md` · `handoff-2026-08-16.md` (백엔드는 `api-backend-status-2026-08-01.md`) |

---

## 2. Newly Discovered — 페이지별 참조 지도

> ND는 **여러 문서를 참조해 만들었다.** 서브영역마다 봐야 할 문서가 다르다.

| ND 페이지/서브 | 봐야 할 기획문서 | 코드 진입점 |
|---|---|---|
| **사이드바·카탈로그·위계** | `plan/frontend-ia-menu-design-plan.md` · `plan/frontend-menu-implementation-plan.md` · `mockups/sidebar-mockup.html` | `sidebar.tsx` · `lib/nd-taxonomy.ts` · `app/page.tsx`(switch) |
| **Overview** | `plan/overview-builder-admin-plan.md`(관리자 구성) · `mockups/overview-mockup.html` | `nd-overview-page.tsx` · `buzz-treemap.tsx` |
| **Digest**(This Week's Highlights · Patch Notes) | `plan/frontend-ia-menu-design-plan.md`(화면 뼈대 = IA 유지) · `docs/ux-design-specification.md` · `docs/PRD/product-scope.md`. 하이라이트 데이터(Buzz·Momentum·Top Picks)는 **백엔드 landing API**(`fetchLanding`) → `base-data/api-backend-status-2026-08-01.md` | `app/page.tsx`(highlight case) · `patch-notes-page.tsx` · `lib/api.ts`(`fetchLanding`) |
| **Cases**(Case Studies · Domain Applications · Product Discovery) | `plan/cases-data-and-page-plan.md` · `content-curation-plan/자료조사-Cases.md` · `content-curation-plan/콘텐츠-수집-분류-페이지구성-방법론.md` | `nd-cases-page.tsx` · `nd-cases-articles-page.tsx` · `nd-cases-best-page.tsx` |
| **Research & Models**(Papers · Model Updates · Benchmarks) | `content-curation-plan/자료조사-Research.md`(§8 Model Updates 순위 포함) · `방법론.md` | `nd-research-page.tsx`(`NDResearchLandscapePage`·`NDPapersPage`·`ModelPopularityRank`) |
| **Discourse**(6분류) | `content-curation-plan/자료조사-Discourse.md` · `방법론.md` | `nd-research-page.tsx`(`NDDiscoursePage`·`NDDiscourseArticlePage`) |
| **Engineering Blocks**(Frameworks · Prompting · Building Blocks) | `plan/building-blocks-data-serving-implementation-plan.md` · `plan/frameworks-landscape-admin-curation-plan.md` (+ `plan/보완기획서/frameworks-landscape-보완기획서.md`) · `mockups/building-blocks-mockup.html` · `mockups/frameworks-mockup.html` | `nd-building-blocks-page.tsx` · `nd-frameworks-page.tsx` · `nd-prompting-page.tsx` · **백엔드** `apps/api/src/modules/frameworks_landscape/` |
| **도메인 렌더 공통**(랜드스케이프 카드) | `방법론.md` §2~§3 (⚠️ 2026-08-16 갱신: **프론트 정적 `StaticDomainLandscape`**) | `nd-landscape.tsx`(`StaticDomainLandscape`·`LandscapeGrid`) |
| **콘텐츠 수집·가공 파이프라인** | `방법론.md` §1 · `staged_mock/백엔드 기사 가공 파이프라인 기획서.md` · **`docs/workflows/source-discovery-workflow.md`**(소스 발굴: Substack 검색→Notion 스테이징, Human-in-the-Loop) | `python_services/*`(수집) · `public/<group>/*.json`(정적) |

> ⚠️ **kind(article/domain)가 콘텐츠의 핵심.** 재분류·렌더 최신 규칙은 `방법론.md`(§1.1 항목별 판정·URL 기준, §1.3 안내문 폴백)와 `frontend-status-2026-08-16.md` 참조.

---

## 3. Learning — 페이지별 참조 지도 (⭐ 다음 작업의 핵심, 자세히)

Learning = **Concept Reader + Basics + Advanced** = 개념 학습 서피스(PRD "Content Structure ① Basics · ② Advanced"). ND(뉴스 큐레이션)와 **성격이 완전히 다르다** — 책·강의에서 뽑은 **개념(concept)** 을 정리해 보여준다.

> ⭐ **구현 기획 폴더 = `apps/docs/learning/`** — `1-work-guidelines.md`(지침·의사결정·갈림길) · `2-implementation-guide.md`(레이아웃 정본[Concept Reader]·단계) · `3-checklist-table.md`(검증) · `개념온톨로지-GraphDB-조사.md`(GraphDB 상세). **Learning 착수 시 이 폴더부터 본다.**

### 3-A. 개념 페이지 4섹션 포맷 (PRD product-scope §1 정본)
모든 개념 페이지(무료·유료 공통)는 아래 4섹션:
1. **Overview** — 기법/방법론 정의 + 왜 중요한지.
2. **Cherries** — 소장 도서·출처에서 뽑은 **MECE 요약**(source 제목 + 핵심 인사이트). "AI가 지어낸 게 아니라 문헌이 실제로 말하는 것".
3. **Child Concepts / Co-occurring** — **Graph DB 온톨로지**의 관련 개념(prerequisite/related/subtopic/extends/contradicts). 예: RAG → Reranking·Hybrid Search·Vector DB.
4. **Progressive References (MECE Learning Path)** — "여기서 시작 → 다음 X → 더 깊게 Y" 순서형 참고자료.

### 3-B. 콘텐츠 파이프라인 (PRD product-scope) — 4단계
```
Curated Text Sources → Evidence Layer 저장(handbook) → Ontology 구축(Graph DB) → Writer Agent 합성(4섹션) → 개념 페이지 발행
```
- 승격 흐름: 새 개념은 **Advanced 먼저** → 지표상 중요해지면 **Basics로 승격**(월 2회차 토요일 리뷰).
- 데이터 원칙(FR): **Concept Layer(안정)** = 명사구 노드만(문장·예시 없음, 근거는 링크만). **Evidence Layer(동적)** = 문단/스니펫 별도 저장(source·excerpt·tags·linked_concepts, 개념과 다대다).

### 3-C. ⚠️ 현재 구현 상태 (정밀 — 반드시 인지)
| 부분 | 상태 |
|---|---|
| **Concept Reader** (`concept-reader-page.tsx`) | 4섹션 포맷 **프로토타입 완성 · 단 데이터 하드코딩**(RAG 예시: Raschka·Chip Huyen·LlamaIndex Cherries 등). **백엔드 미연결.** |
| **Basics(6)·Advanced(6) 토픽** (`handbook-placeholder.tsx`) — PRD §1·§2 명시 토픽만 | **placeholder("Handbook In Progress")** — 제목/설명만 하드코딩(`TOPIC_META`). 실제 콘텐츠 없음. |
| **백엔드 writer_agent 모듈** (`apps/api/src/modules/writer_agent/`) | **구축됨** — `POST /api/writer-agent/input`(토픽 매칭 handbook v2 evidence 패키징), `GET /api/writer-agent/related-concepts?topic=`(GraphDB SPARQL 관련개념). `AgentApiKeyGuard`. |
| **Ontology 서비스** (`python_services/packages/idea_to_graph_ontology/`) | **구축됨** — Graph DB(`llm-ontology`) + vector store. |
| **➡️ 미완(다음 큰 작업)** | 프론트 개념 페이지(Concept Reader/Basics/Advanced)를 **백엔드(writer_agent·handbook·ontology)에 연결**해 하드코딩·placeholder를 **실제 데이터**로 교체. |

> **토픽 목록 이력(2026-08-16)**: 원래 Basics가 **근거 없는 하드코딩 24개**였다(기획문서 어디에도 없었고 `sidebar.tsx`·`handbook-placeholder.tsx` 두 파일에만 존재). PRD §1·§2에 **열거된 것만** 남기기로 결정해 Basics 24→6, Advanced 6개도 PRD 문구 기준으로 교체했다(`(and then more added by team)`는 미반영). 경위·id 매핑표는 `handoff-2026-08-16.md` §3-7 · `frontend-status-2026-08-16.md` §4.
> ⚠️ **현재 UI 12개 id는 UI 전용**이며 **토픽 마스터 정본인 DB `handbook.topic`/`handbook.subtopic`과 매핑되어 있지 않다.** 프론트-백엔드 연결 작업의 **첫 과제가 이 매핑**이다(DB의 실제 토픽 행은 아직 미확인).

### 3-D. 페이지/단계별 참조 문서
| Learning 대상 | 봐야 할 기획문서 | 코드/서비스 |
|---|---|---|
| **스펙**(4섹션·파이프라인·승격) | `docs/PRD/product-scope.md` §1·§2 ⭐ · `docs/PRD/functional-requirements.md`(Concept/Evidence Layer FR) · `plan/frontend-ia-menu-design-plan.md`(LEARNING 절) | — |
| **Concept Reader 화면(레이아웃)** ⚠️ | **전용 화면기획 문서 없음** — PRD §1은 콘텐츠 4섹션만(레이아웃 아님), UX 스펙(`docs/ux-design-specification.md`)은 디자인 시스템 + Handbook **Placeholder** 컴포넌트만, 실제 와이어프레임은 **외부 "UI & Information Architecture(260415)"**(리포에 없음). **화면 목업도 없음**(`mockups/`엔 sidebar·overview·building-blocks·frameworks만). | **de facto 화면 = 코드 `concept-reader-page.tsx`** — RAG 예시로 4섹션 구현(01 Overview·02 Cherries·03 Child Concepts·04 Progressive References + "Buy on Market" 버튼) |
| **Basics/Advanced 토픽·목록** | `plan/frontend-ia-menu-design-plan.md`(동적 개념 목록) | `sidebar.tsx`(토픽 리스트) · `handbook-placeholder.tsx` · `app/page.tsx`(→`HandbookPlaceholder`) |
| **Evidence Layer(handbook 스키마)** | `docs/architecture/handbook-ddl-redesign-proposal.md`(전면 재설계) · `handbook-ddl-revision-proposal.md`(수정안) · `handbook-v2-summary.html`(요약) · `docs/architecture/data-architecture.md` | handbook v2 테이블(Postgres) |
| **Ontology(Concept Layer·Graph DB — 상위/하위 개념)** ⭐ | **`../learning/개념온톨로지-GraphDB-조사.md`**(상세 조사) · `docs/PRD/functional-requirements.md`(Concept/Evidence 분리) · `docs/architecture/data-architecture.md` | `python_services/packages/idea_to_graph_ontology/`(GraphDB Ontotext, `rdfs:subClassOf` 계층) · 백엔드 `writer_agent/graph-concept.service.ts`(SPARQL) |
| **Writer Agent(합성)** | `apps/docs/legacy-docs/api-backend-status-2026-07-13.md` §2-4(엔드포인트) · (참고 legacy 데이터매핑: `agent-output-spec-for-ddl.md`·`agent-json-db-mapping.md`·`cherry_to_JSON.md`) | `apps/api/src/modules/writer_agent/`(controller·service·graph-concept.service) |

> ⚠️ Learning 착수 정본 = **PRD product-scope §1·§2(포맷·파이프라인) + functional-requirements(Concept/Evidence 데이터 모델) + handbook-ddl 재설계안**. 백엔드 writer_agent 엔드포인트는 **이미 있으니**, 프론트 연결 시 그 계약(`/writer-agent/input`, `/related-concepts`)부터 확인.

---

## 4. 상위/역사 문서 (필요 시)

- `docs/PRD/`(전체: executive-summary·success-criteria·acceptance-criteria 등) · `docs/architecture/index.md`(아키텍처 인덱스) · `docs/epics.md`(에픽 — 입력문서 목록 포함)
- **교차 인프라(특정 ND/Learning 페이지 아님, 참고)**: `apps/docs/plan/analytics-two-surface-implementation-plan.md`(회원통계 + GA4 유입분석, 미구현 — Digest 페이지와 무관) · `docs/architecture/data-architecture.md`(데이터 모델)
- `docs/ux-design-specification-backup-20260404.md`(UX 백업)
- 과거: `apps/docs/legacy-docs/`(handoff·status·handbook.html·webapp.md) · `apps/docs/base-data/handoff-2026-08-01.md`(ND 최초 구축) · `frontend-status-2026-08-01.md`(안 바뀐 기본 구조)

---

## 5. 유지보수 노트
- 이 지도는 **가리키기만** 한다. 각 문서가 정본이며, 어긋나면 원문·코드가 정답(작업지침 §1-10).
- 새 feature 기획문서를 만들면 위 표에 한 줄 추가한다.
