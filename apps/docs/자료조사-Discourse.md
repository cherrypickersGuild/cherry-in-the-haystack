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
