# 자료조사 재현 가이드 — Discourse

다른 에이전트가 **동일하게 Discourse 데이터를 재수집**할 수 있도록 기록한다.
상위 방법론은 [`콘텐츠-수집-분류-페이지구성-방법론.md`](./콘텐츠-수집-분류-페이지구성-방법론.md), 형제 문서 [`자료조사-Cases.md`](./자료조사-Cases.md) · [`자료조사-Research.md`](./자료조사-Research.md).

- 산출물: `apps/web/public/discourse/{entities,icons,pages}.json`
- 총 **1151항목**, **6개 카테고리 전부 kind=article**(뉴스·오피니언·리소스 — 제품/도메인 없음 → 도메인형 랜드스케이프 없음, 6개 모두 기사형).
- 수집 스크립트: `collect-discourse.cjs`

---

## 1. 성격 판정 (수집 전 조사)

Discourse는 **시의성 뉴스·오피니언**이라 Cases(엔지니어링 블로그)·Research(논문·모델·벤치마크)처럼 깔끔한 안정 큐레이션이 적다(원 기획은 RSS 크롤링). 그래도 6개 다 정적 큐레이션 소스를 확보했다. **kind는 6개 전부 `article`.**

## 2. 출처·볼륨·그룹축 (실측)

| category | 출처 | 볼륨 | 그룹축(domain) | 비고 |
|---|---|---|---|---|
| **regulations-policy-compliance** | `github.com/Myr-Aya/awesome-ai-governance` | 54 | **주제 섹션**(Security & Threat, Risk, Governance, Ethics, Regulation…) | 프레임워크·표준 |
| **community** | `github.com/The-AI-Alliance/community` → `events/awesome-ai-conferences.md` | 28 | **지역**(North America·Europe·Asia&MEA·Global·Online) | 컨퍼런스 |
| **big-tech-trends** | **큐레이션**(레포 아님) | 21 | **카테고리**(Foundation Model Labs·Big Tech AI·Open & Platform·Global AI) | ⚠️ 랜덤 회사블로그 목록은 부적합 → 주요 AI org를 직접 큐레이션 |
| **market-investment** | `github.com/joylarkin/Awesome-AI-Market-Maps` | 536 | **연도**(분기 원본 → 2024/2025/2026 통합) | VC 마켓맵 |
| **technical-deep-dives** | `github.com/eugeneyan/applied-ml` | 455 | **주제**(31개 원본 → 8개 통합) | ⚠️ **Cases와 URL 중복 68개 제거**(겹치면 안 됨) |
| **insights-opinions** | `github.com/csarigoz/best-ai-newsletters` | 57 | **뉴스레터 유형**(General·Technical·Business·Research…) | 뉴스레터(개별 글 아님) |

```bash
curl -sL https://raw.githubusercontent.com/Myr-Aya/awesome-ai-governance/main/README.md         -o dc-reg.md
curl -sL https://raw.githubusercontent.com/The-AI-Alliance/community/main/events/awesome-ai-conferences.md -o dc-comm.md
curl -sL https://raw.githubusercontent.com/sumodirjo/engineering-blogs/master/README.md          -o dc-bigtech.md   # 참고용(사용 안 함)
curl -sL https://raw.githubusercontent.com/joylarkin/Awesome-AI-Market-Maps/main/README.md       -o dc-market.md
curl -sL https://raw.githubusercontent.com/eugeneyan/applied-ml/main/README.md                    -o dc-tech.md
curl -sL https://raw.githubusercontent.com/csarigoz/best-ai-newsletters/main/README.md            -o dc-insights.md
```

## 3. 파싱 패턴

- **regulations**: `## 주제` 섹션(Contents/Selection/Related/Contributing 제외) 아래 `- [name](url) - desc`.
- **community**: `* DD [Name](url) - City (Country)` → 국가에서 지역 매핑.
- **big-tech-trends**: 레포 대신 **주요 AI org 큐레이션**(OpenAI·Anthropic·Google DeepMind·Meta AI·Microsoft·NVIDIA·Hugging Face·Qwen·DeepSeek 등)을 카테고리별로 직접 작성. (랜덤 회사블로그 230개는 "전략 동향"과 안 맞아 제외.)
- **market-investment**: `## AI Market Maps - Qx YYYY` 아래 `- [Author - Title - Month YYYY](url)` → Title 추출, `?utm` 제거.
- **technical-deep-dives**: `## 주제` 아래 `N. [Title](url) \`Company\` \`Year\``. TOC(`(#anchor)`)는 http 아니라 자동 제외.
- **insights-opinions**: `## 유형` 아래 `- ⭐ (Sponsored)? [Name](url) - desc` → 접두어 제거.

## 4. kind & 정규화

- **kind = "article"** (6개 전부). 수집 시 명시.
- **도메인 정규화(pages.json domainMap)**: technical 31개 주제 → 8개(Data & Features·Prediction·RecSys & Search·NLP & LLMs·Vision & Audio·MLOps & Infra·Practices & Testing·Other ML), market 분기 → 연도(2024/2025/2026).
- **Cases 중복 제거(technical)**: applied-ml 각 URL을 Cases `entities.json` URL(host+path, 쿼리/슬래시 정규화)과 대조해 이미 있으면 제외. (68개 제거 → "겹치면 안 됨" 충족.)

## 5. summary — 실측(단계적), 지어내지 않음

- 방식은 [`자료조사-Research.md`](./자료조사-Research.md) §4와 동일: 웹 메타(og/twitter/description/JSON-LD, `facebookexternalhit`) → arxiv API(논문형).
- **커버리지: 82%(943/1151)** — regulations·community·big-tech·insights 100%, market 85%, technical 71%.
- **못 채운 208개**는 소스가 막혀 있음(실측): `engineering.linkedin.com`/`linkedin.com`(로그인 월), `eng.uber.com`·`research.google`·`dl.acm.org`(JS 렌더/봇차단 — 브라우저 UA로도 메타 없음). **폴백은 제목만, 지어내지 않음.** 논문형(ACM 등)은 Semantic Scholar로 추가 가능하나 무키 429 잦음.

## 6. 스키마 & 구성요소

```jsonc
{ "id","category","kind","domain","name","company","description","summary","tags","source_type","url","date","source" }
```
- source_type: `framework`·`event`·`org`·`market-map`·`article`·`newsletter`.
- JSON 3층: `discourse/entities.json`(+summary+kind) · `icons.json`(색·이모지) · `pages.json`(6 카테고리 카드·탭·**domainMap**).
- 화면: 상위 카탈로그 `NDDiscoursePage`(= 공용 `GroupCatalog`), 하위 6개 `NDDiscourseArticlePage`(= 공용 `CasesArticleList base="discourse"`). 6개 전부 기사형.

---

## 7. 대표 픽 (Featured) — 각 서브 페이지 맨 위 1개, 기준별

6개 카테고리 각 페이지 최상단에 대표 1개를 픽한다. **데이터 성격이 갈려 기준이 다르다.** 재수집 시 이 기준대로 자동 선정된다(결정적).

**공통 점수:** 요약(>40자) **+5**, 인기주제 매칭(name/domain/tags) **+3**, 인지도 회사(company) **+2**, 유명 엔티티 매칭(name) **+4**. 최고점 1개, 동점은 원본 순서.

| category | 데이터 | 후보 pool | 가중 요소 | 라벨 |
|---|---|---|---|---|
| **market-investment** | 날짜 O(분기) | **최신 연도**(2026) | prominent: a16z·Andreessen·Sequoia·Bessemer·CB Insights·Air Street·Menlo·Coatue·"State of AI" / trending: agent·infrastructure·foundation·compute·inference·data center·hardware | **Featured Map** — "Fresh market view" |
| **technical-deep-dives** | 날짜 O(연도) | **최신 연도** | trending: llm·agent·rag·generative·multimodal·prompt·fine-tune·embedding·ranking·recommendation / notable: Netflix·Uber·Meta·Google·Airbnb·LinkedIn·Instacart·DoorDash·Stripe·Dropbox·Pinterest·Amazon·Microsoft·Spotify·Lyft·Swiggy | **Featured Read** — "Deep dive worth your time" |
| **regulations-policy-compliance** | 날짜 X | 전체 | prominent: NIST·ISO/IEC 42001·EU AI Act·MITRE ATLAS·OWASP | **Key Framework** — "The one to know" |
| **community** | 날짜 X | 전체 | prominent: NeurIPS·ICML·ICLR·AI Action Summit·CVPR·ACL·AI Engineer | **Featured Event** — "Don't miss this" |
| **big-tech-trends** | 날짜 X | 전체 | prominent: OpenAI·Anthropic·Google DeepMind·DeepMind | **Lab to Watch** — "Frontier player right now" |
| **insights-opinions** | 날짜 X | 전체 | prominent: The Batch·Import AI·The Gradient·Latent Space·Ahead of AI·Interconnects | **Featured Newsletter** — "Worth subscribing" |

**메커니즘:** `nd-cases-articles-page.tsx`의 `FEATURED_CFG` — 날짜 있으면 최신 연/분기 pool, 없으면 전체 pool → 위 점수. `NDDiscourseArticlePage`가 `featured`로 렌더. Cases(`Featured Read`)·Papers(`Featured Paper`)와 **동일 공용 로직**, 카테고리마다 가중 집합·라벨만 다름.

**보완점(개선 여지):**
- **technical-deep-dives**: 소스(applied-ml)에 2025 글이 없어 최신 연도(2024) pool이 좁고 픽이 밋밋. → pool을 **최근 2개 연도**로 넓히거나(trending 가중을 더 세게), 더 최신 소스 병합.
- **market-investment**: 현재 pool을 "최신 연도(2026)"로 잡는데, 2026 안에 Q1~Q3가 섞임 → **최신 분기(Q3 2026)**로 더 좁히면 신선도↑.
- **무날짜형(regulations·community·big-tech·insights)**: `prominent` 정규식에 **미매칭이면 요약만으로 임의 선택**됨. 유명 엔티티 리스트를 주기적으로 갱신해야 하고, 미매칭 시 폴백(예: 요약 길이·태그 다양성) 규칙을 추가하면 안정적.
- prominent/notable/trending 집합이 코드(`FEATURED_CFG`)에 있음 → 방법론상 pages.json로 이전 여지(아래 방법론 문서).
