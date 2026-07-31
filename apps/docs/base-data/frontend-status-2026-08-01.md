# 프론트엔드 현황 (기준일: 2026-08-01)

> `apps/web`(Next.js 16 App Router). 이 세션의 초점은 **Newly Discovered 4개 그룹(Engineering·Cases·Research & Models·Discourse)의 콘텐츠 페이지 시스템**. 백엔드는 `api-backend-status-2026-08-01.md`, 인수인계 요약은 `handoff-2026-08-01.md`.

---

## 0) 네비게이션 모델 (필독)

- **개발자 앱(`/`)은 URL 라우트가 아니라 상태 기반.** `app/page.tsx`가 `activeNav`(id) 를 `switch`로 렌더.
- **메뉴/위계 단일 소스**: `lib/nd-taxonomy.ts` (`ND_GROUPS` 4개 · `ND_ITEMS`).
  - 그룹 헤더 클릭 → `landingId`(있으면) 활성화 = **카탈로그(블록 페이지)**.
  - 그룹 `children` = 사이드바 서브 항목.
  - `existing:true` 항목 → `page.tsx` switch의 실제 컴포넌트로 렌더. `existing` 없으면 `NDSpecPage`(기획페이지).
- 새 페이지 추가 = ① taxonomy(항목/`existing`/`landingId`) ② `page.tsx` case ③ 컴포넌트.

---

## 1) 콘텐츠 그룹 구조 (핵심 아키텍처)

각 그룹 = **상위 카탈로그 1개 + 하위 서브 N개**. 서브는 데이터 성격(kind)에 따라 **기사형** 또는 **도메인형(랜드스케이프)**.

| 그룹 | 카탈로그(landingId) | 서브 | 서브 형식 |
|---|---|---|---|
| **Engineering Blocks** | `building-blocks` (`NDBuildingBlocksPage`) | Frameworks Best · Prompting Best | 도메인형 랜드스케이프 + Rising Star |
| **Cases** | `cases-catalog` (`NDCasesPage`) | Case Studies | 기사형(+Featured) |
| | | Domain Applications · Product Discovery | **혼합**(도메인형 랜드스케이프 + 기사형 목록 + Rising Star) |
| **Research & Models** | `research-catalog` (`NDResearchPage`=`GroupCatalog`) | Papers | 기사형(+Featured) |
| | | Model Updates | 도메인형 랜드스케이프 + **인기 순위표** + Rising Star |
| | | Benchmarks & Datasets | 도메인형 랜드스케이프 + Rising Star |
| **Discourse** | `discourse-catalog` (`NDDiscoursePage`=`GroupCatalog`) | 6분류(Regulations·Community·Big Tech·Market·Technical·Insights) | 전부 기사형(+Featured) |

---

## 2) 컴포넌트 지도 (`apps/web/components/cherry/`)

| 파일 | export | 역할 |
|---|---|---|
| `nd-cases-page.tsx` | `NDCasesPage` | Cases 카탈로그("Cases - Building Blocks"). 통계표 + 언더라인 탭 + 도메인 섹션 카드. |
| `nd-cases-articles-page.tsx` | `CasesArticleList` · `NDCasesListPage` · (내부)`FeaturedRead`·`ArticleRow`·`FEATURED_CFG` | **기사형 공용.** prop `base`(cases/research/discourse)·`kind`·`featured`. Case Studies 전용 페이지 = `NDCasesListPage`. |
| `nd-cases-best-page.tsx` | `NDCasesBestPage` | **혼합 페이지**(domain-applications·product-discovery): Rising Star + 랜드스케이프(kind=domain) + `CasesArticleList kind="article"`. |
| `nd-research-page.tsx` | `NDResearchPage`·`NDDiscoursePage`·`NDPapersPage`·`NDResearchLandscapePage`·`NDDiscourseArticlePage` + (내부)`GroupCatalog`·`ModelPopularityRank`·`PopCard` | Research·Discourse 카탈로그(공용 `GroupCatalog`), Research 서브, Discourse 서브, Model Updates 순위표. |
| `nd-landscape.tsx` | `LandscapeSection`·`RisingStar` | 도메인형 랜드스케이프(백엔드 API) + Rising Star(스타 없으면 대표 1개 featured 폴백). |
| `nd-frameworks-page.tsx` / `nd-prompting-page.tsx` | `NDFrameworksPage`/`NDPromptingPage` | Best 페이지: **Rising Star 맨 위 → Landscape**. Frameworks의 DB 기사(Recent Updates)는 숨김(비-JSON). |
| `nd-model-updates-page.tsx` | `NDModelUpdatesPage` | **구 DB 순위표(미사용, 라우팅에서 빠짐).** 원본 `RankCard`·`CATEGORY_LOGOS` 디자인 참조용. |

---

## 3) 데이터 JSON (`apps/web/public/`) — 3층 구조

그룹마다 `<group>/{entities,icons,pages}.json`. 컴포넌트가 정적 fetch(하드코딩 금지).

- **entities.json** — 기초조사. 항목 필드: `id,category,kind,domain,name,company,description,summary,tags,source_type,url,date,source`. **kind**=article|domain.
- **icons.json** — `palette`(8색) + `themePools`(정규식→이모지) + `neutral`.
- **pages.json** — 분류별 `title,subtitle,sectionTitle,tabs,card(필드매핑),domainMap,sourceTypeLabels`. **domainMap**으로 파편 도메인 통합(domain-apps 65→17, discourse technical 31→8·market 분기→연도).
- **research/model-rank.json** — Model Updates HF 인기순위(21) + `logo` 경로. `public/logos/model/*` (21 org 공식 로고).

> 랜드스케이프만 예외 — 프론트가 아니라 **백엔드 `/api/<page>/landscape`**(생성물). 나머지(카탈로그·기사목록·Featured·순위표)는 정적 JSON.

---

## 4) 주요 기능 로직

### 4-1. 대표 픽 (Featured) — `FEATURED_CFG` (nd-cases-articles-page.tsx)
- 페이지 맨 위 1개 자동 선정(결정적). 점수: 요약(>40자)+5 · 인기주제(name/domain/tags)+3 · 인지도회사(company)+2 · 유명엔티티(name)+4.
- pool: `date`에 연도 있으면 **최신 연/분기**, 없으면 전체.
- 대상 8분류(case-studies·papers·discourse 6). 라벨·가중 집합은 분류마다 다름. **기준 정본은 `자료조사-*.md`**.
- ⚠️ **보완**: `FEATURED_CFG`가 코드 하드코딩 → pages.json 이전 여지. og:description이 저자 나열이면 픽 품질 저하(요약 품질 필터 필요).

### 4-2. Model Updates 인기 순위표 — `ModelPopularityRank`/`PopCard`
- `research/model-rank.json`(HF 다운로드·좋아요·로고) 읽어 **원본 "Major Players" 포디움**(#1 lg·#2/#3 md·나머지 sm) 렌더, **7위까지**. 로고는 `<img src={r.logo}>`.
- 페이지 순서: **순위 → Rising Star → Landscape**.

### 4-3. 탭 스타일 (일관성 규칙)
- **Discourse 카탈로그만 pill 버튼**(6탭 2줄, 통계표 없음). 나머지 카탈로그(Engineering·Cases·Research)는 **통계표 + 언더라인 탭**.
- 서브 **기사형의 섹터 탭은 pill**(다수·2줄이라). 기사 섹션은 **섹션 제목이 탭 위**(무슨 섹션인지 먼저 알림).

---

## 5) 라우팅 / taxonomy 변경 (`app/page.tsx`, `lib/nd-taxonomy.ts`)
- `page.tsx` switch에 추가: `cases-catalog`·`research-catalog`·`discourse-catalog`(카탈로그), `case-studies`(NDCasesListPage), `domain-applications`·`product-discovery`(NDCasesBestPage), `papers`(NDPapersPage), `model-updates`·`benchmarks-datasets`(NDResearchLandscapePage), discourse 6분류(NDDiscourseArticlePage). `NDModelUpdatesPage` import 제거.
- 폭: `frameworks`·`prompting`·`domain-applications`·`product-discovery`·`model-updates`·`benchmarks-datasets` = `max-w-[1160px]`(랜드스케이프), 나머지 1000.
- taxonomy: 그룹 `landingId`(cases-catalog·research-catalog·discourse-catalog), 서브 `existing:true`(papers·benchmarks-datasets·discourse 6), 카탈로그 히든 항목 추가.

---

## 6) 알려진 이슈 / 보완점
- **요약 커버리지 미완**: Discourse 82%(LinkedIn/Uber/Google/ACM 차단), Papers 2건(GPT-1/2, S2 429). 폴백은 제목/description — 지어내지 않음.
- **FEATURED_CFG·prominent 리스트 하드코딩** → JSON 이전 + 유지보수.
- **`nd-model-updates-page.tsx` 미사용** — 삭제/보존 결정 필요.
- 기존 무관 tsc 에러(`kaas-admin-page.tsx`·`kaas-dashboard-page.tsx`) — 작업지침 §7, 우리 작업과 무관.
- 브라우저 프리뷰 불안정(read_page 빈응답) — 결정적 로직은 node 재현으로 검증 권장.

---

## 7) 참고 문서
- 방법론: `콘텐츠-수집-분류-페이지구성-방법론.md`
- 재현 가이드: `자료조사-Cases.md` · `자료조사-Research.md` · `자료조사-Discourse.md`
- 백엔드: `api-backend-status-2026-08-01.md` · 인수인계: `handoff-2026-08-01.md`
