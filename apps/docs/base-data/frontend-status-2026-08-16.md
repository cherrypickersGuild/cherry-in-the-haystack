# 프론트엔드 현황 (기준일: 2026-08-16)

> `apps/web`(Next.js 16 App Router). 이번 세션의 초점: **Newly Discovered 3그룹(Cases·Research·Discourse)의 kind 항목별 재분류 + 도메인 렌더링을 프론트 정적으로 일원화**, 사이드바/Overview 등 UI 개선, 그리고 **Learning(Basics·Advanced) 토픽을 PRD 명시분으로 축소**(§4).
> **08-01 대비 델타 문서.** 안 바뀐 기본 구조(콘텐츠 그룹·JSON 3층·카탈로그 등)는 `frontend-status-2026-08-01.md`가 여전히 유효. 여기선 **바뀐 것만** 정리한다.
> 함께 볼 것: `handoff-2026-08-16.md`(서술형 요약) · `api-backend-status-2026-08-01.md`(**백엔드 변경 없음** — 그대로 유효).

---

## 0) 네비게이션 (변경)

- **기본 접속 페이지 = Overview**(`nd-overview`). `app/page.tsx` `useState("nd-overview")`. (예전 기본 `highlight`.)
- **사이드바 멀티오픈**(`components/cherry/sidebar.tsx`): 그룹 헤더 **본문 클릭 = 이동 + 펼치기(절대 안 닫음)**, 오른쪽 **넓은 화살표 존(40×33px) = 접기/펴기 토글**. 여러 그룹 동시 펼침, 상태 localStorage(`cherry_sidebar_collapsed`) 저장. (아코디언/단일오픈은 "메뉴 튐"으로 폐기.)
- **메뉴 정리**: "This Week's Highlights" 사이드바 항목 삭제, Patch Notes만 남은 DIGEST 섹션을 **최하단**으로.
  - ⚠️ **highlight 페이지 컴포넌트는 `page.tsx` switch `default:` 폴백으로만 존재**(메뉴 도달 불가). 제거 여부 미결정.
- **폭**: 넓은 폭(max-w-[1160px]) 목록에 discourse 6분류 + `papers` 추가(도메인 랜드스케이프용).

---

## 1) ⭐ 콘텐츠 렌더링 — 프론트 정적 도메인으로 일원화 (핵심 변경)

**예전:** ND 도메인/혼합 페이지가 백엔드 `LandscapeSection`(`GET /api/<page>/landscape`, 생성 스크립트 필요)에 의존.
**지금:** **`StaticDomainLandscape`(프론트 정적)** — `/<base>/entities.json`의 `kind==="domain"`을 `domain`별로 그룹핑해 카드로 렌더. 백엔드 불필요.

| 항목 | 내용 |
|---|---|
| **신규 컴포넌트** | `nd-landscape.tsx` → `StaticDomainLandscape({ base, page })` + 표시전용 `LandscapeGrid({ categories })`(카드·모달 추출, 재사용) |
| **카드 미리보기** | 도메인 그룹당 **최대 5줄 = 4개 + "+N more"**(5개 초과 시). **카드 클릭 → 모달에 전체.** |
| **아이콘** | 카탈로그(`GroupCatalog`)와 **동일 `makeEmoji`**(icons.json `themePools` + 이름 해시 → 항목별 다양). 예전의 획일 이모지 폐기. |
| **혼합 렌더 구조** | 헤더 → (domain>0이면) 도메인 카드 섹션 → (article>0이면) `CasesArticleList kind="article"` 목록 |
| **백엔드 랜드스케이프** | 이제 **Engineering(frameworks/prompting) 전용.** ND는 `LandscapeSection`/`RisingStar`/`/api/<page>/landscape` **미사용**. |

**혼합 페이지 컴포넌트(모두 `StaticDomainLandscape` + `CasesArticleList` 사용):**
- **Discourse**: `NDDiscourseArticlePage`(`nd-research-page.tsx`) — 6분류 공용. 순수 도메인(community·big-tech·insights)은 도메인 카드만.
- **Research**: `NDResearchLandscapePage`(`nd-research-page.tsx`) — model-updates·benchmarks·papers 공용. `NDPapersPage`는 여기에 **위임**. **model-updates는 HF 인기 순위표(`ModelPopularityRank`) 맨 위 유지**(단, 순위 카드의 다운로드 하강 화살표 제거). 기사 섹션명 "Papers".
- **Cases**: `NDCasesBestPage`(`nd-cases-best-page.tsx`) — domain-applications·product-discovery.

**Featured**: discourse/research 기사 섹션은 `featured` 프롭 미전달 → **Featured 배너 비활성**(`FEATURED_CFG` 코드는 잔존). 도메인 카드 첫 항목 spotlight로 대표 표시.

---

## 2) ⭐ kind 항목별 재분류 (데이터)

`public/{cases,research,discourse}/entities.json`의 `kind`를 **항목별로** 재판정(§방법론 §1.1). 기준: 지속 실체=domain, 발행물 1건=article. **Research는 URL 기준**(arxiv/논문 링크=article, 실제 사이트/HF/리포=domain).

| 그룹 | 분류 | domain | article |
|---|---|---:|---:|
| cases(914) | case-studies · product-discovery · domain-applications | 0·123·110 | 543·101·37 |
| research(208) | papers · model-updates · benchmarks-datasets | 6·70·**10** | 56·3·**63** |
| discourse(1151) | reg · community · big-tech · market · technical · insights | 49·28·21·116·4·57 | 5·0·0·420·451·0 |

- 렌더는 kind로 자동 분리(domain→카드, article→목록). **혼합이 정상**, 순수 단일도 있음(case-studies 전부 article 등).

**빈 카드 안내문**: 요약·설명 둘 다 없던 148개(domain-applications 20 + technical-deep-dives 128)의 `summary`에 **정직한 소스별 안내문**(위키/논문/차단소스/기타) 삽입 — 스크래핑/생성 아님, 원문 링크 유도.

---

## 3) Overview 개편 (`nd-overview-page.tsx`, `buzz-treemap.tsx`)

- **Buzz Distribution 이관**: Digest → Overview. 순서 = Hero → Worth a Look → Just Added → **Buzz Distribution** → 반복 블록. `CategoryTreemap`에 `showHeader` prop 추가(Overview에선 `SectionHead`로 대체).
- **히어로 캐러셀 무한 슬라이드**: 양끝 클론(`[마지막,...실제,첫]`) + 좌우 화살표 항상 표시. 끝을 넘으면 옆에서 슬라이드로 들어오고, idle(130ms) 후 실제 슬라이드로 순간 이동(이음매 제거).
- **Digest highlight 페이지**: 트리맵 제거 → Trending Momentum 전폭 3열 + Top Picks (단, 메뉴에서 빠져 orphaned).

---

## 4) Learning — Basics/Advanced 토픽을 PRD 명시분으로 축소

**배경**: 사이드바의 Basics 24개 토픽은 **기획문서에 근거가 없었다.** 저장소 전체 grep 결과 `sidebar.tsx`·`handbook-placeholder.tsx` **두 파일에만** 존재(PRD·IA 기획안·handbook DDL·시드 어디에도 없음). 사용자 결정으로 **PRD `docs/PRD/product-scope.md` §1·§2에 열거된 토픽만** 남기고, `(and then more added by team)`는 메뉴에 반영하지 않기로 함.

| 섹션 | 전 | 후 | 항목 (사이드바 라벨 / id) |
|---|---:|---:|---|
| Basics | 24 | **6** | Prompt Engineering `prompting-reasoning` · RAG `rag-systems` · Fine-tuning **신규** `fine-tuning` · Agents `agents-reasoning` · Embeddings **신규** `embeddings` · Evaluation `evaluation-systems` |
| Advanced | 6 | **6** | Advanced Prompting `chain-of-thought` · Multi-hop RAG `multi-hop-rag` · PEFT / LoRA / QLoRA `peft-lora` · Multi-agent Orchestration `agent-topologies`(재활용) · Custom Embeddings `custom-embeddings` · Adversarial Evaluation `adversarial-eval` |

- **id 정책**: 기존 id 최대 재사용(**신규 2개만**) — 사이드바 펼침 localStorage·기존 링크 영향 최소화. **라벨**은 IA 기획안(`plan/frontend-ia-menu-design-plan.md` §1)의 짧은 표기, **페이지 제목**(`TOPIC_META.title`)은 PRD 원문 문구("Fine-tuning Strategies" 등).
- **⚠️ 이 id들은 UI 전용이다.** 토픽 마스터의 정본은 **DB `handbook.topic`/`handbook.subtopic`** (`apps/api/src/modules/writer_agent/writer-agent.service.ts`가 `LEFT JOIN handbook.topic`으로 실제 사용 중). 나중에 연동할 때 **매핑이 필요**하며, 지금 스키마에 맞추지 않았다.
- 삭제된 19개 id는 개발자 앱 밖에서 참조 없음(실측). `memory`는 `/start` 워크숍 **스킬 슬롯 타입**, `chain-of-thought`는 **KaaS 마켓 컨셉 id**로 각각 별개 네임스페이스 — 사이드바 `activeNav`와 무관.
- **페이지 실체는 여전히 없다.** 12개 전부 `HandbookPlaceholder` 한 컴포넌트로 렌더("Handbook In Progress"). Concept Reader도 RAG 하드코딩 목업(`READER_CONCEPT_ID = "rag"`, `CHERRIES`/`CHILD_CONCEPTS`/`REFERENCES` 상수).
- 검증: `tsc --noEmit` 신규 에러 0(기존 무관 8건만) · 3개 파일 목록 일치 node 교차검증 7항목 PASS(고아 메뉴 0·죽은 case 0) · dev 서버에서 12개 렌더 및 신규 `fine-tuning` 페이지 실동작 확인.

---

## 5) 컴포넌트 지도 델타 (08-01 대비)

| 파일 | 변경 |
|---|---|
| `nd-landscape.tsx` | **`StaticDomainLandscape`·`LandscapeGrid` 추가**, `makeEmojiFn`, 카드 4+"+N more" 캡. `LandscapeSection`/`RisingStar`는 유지(Engineering 전용). |
| `nd-research-page.tsx` | `NDDiscourseArticlePage`·`NDResearchLandscapePage` **혼합 렌더로 재작성**, `NDPapersPage` 위임, `PopCard` 화살표 제거. |
| `nd-cases-best-page.tsx` | 백엔드 `LandscapeSection`/`RisingStar` → **`StaticDomainLandscape`**. |
| `sidebar.tsx` | 멀티오픈 + 넓은 화살표 존, DIGEST 최하단, highlight 항목 삭제. |
| `app/page.tsx` | 기본 `nd-overview`, 넓은 폭 목록 확장(discourse 6 + papers). |
| `nd-overview-page.tsx` | Buzz Distribution 섹션, 무한 캐러셀. |
| `buzz-treemap.tsx` | `showHeader` prop. |
| `sidebar.tsx`(LEARNING) | Basics children 24 → **6**, Advanced 라벨·순서를 PRD 기준으로 교체(§4). |
| `app/page.tsx`(Learning) | `HandbookPlaceholder` switch case 30 → **12**. |
| `handbook-placeholder.tsx` | `TOPIC_META` 30 → **12**항목, 제목을 PRD 문구로. |

---

## 6) 알려진 이슈 / 미결정
- **Learning 콘텐츠·DB 파이프라인 미구현** — 12개 토픽 전부 placeholder. 개념 페이지 4섹션 포맷의 정본은 `docs/PRD/product-scope.md` §1 + `docs/architecture/handbook-ddl-{redesign,revision}-proposal.md`.
- **PRD 승격 플로우와의 정합성**(FR-4.3: 신규 개념은 Advanced에서 시작 → 지속 중요도 평가로 Basics 승격) — 현재 6:6 배치가 이 흐름과 맞는지는 **콘텐츠를 채울 때 재검토** 필요.
- `HandbookPlaceholder` 하단 안내문이 **삭제된 "This Week's Highlight"** 를 가리킴(죽은 링크 텍스트, 미정리).
- **highlight 페이지** 완전 제거 여부(현재 `default:` 폴백만).
- **백엔드 랜드스케이프 정리**: `LANDSCAPE_PAGES`의 ND 페이지·`generate-{cases,research}-landscape.cjs`·`LandscapeSection`/`RisingStar`는 ND 미사용(정리 후보). ND는 **배포 후 랜드스케이프 재생성 불필요**.
- **Featured** discourse/research 비활성 — 도메인용으로 되살릴지.
- 빈 카드 안내문은 임시 폴백(실제 요약 아님). 차단소스는 원문 못 긁음.
- 기존 무관 tsc 에러 8건(kaas) 무시.

---

## 7) 참고
- 서술형 요약: `handoff-2026-08-16.md` · 백엔드(변경 없음): `api-backend-status-2026-08-01.md`
- 기본 구조(안 바뀐 부분): `frontend-status-2026-08-01.md`
- 방법론/재현: `../content-curation-plan/콘텐츠-수집-분류-페이지구성-방법론.md` · `자료조사-*.md`
