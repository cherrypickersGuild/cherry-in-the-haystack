# 자료조사 재현 가이드 — Research & Models

> ⚠️ 2026-08-01 갱신: kind를 URL 기준으로 재판정(위 분포) + 혼합 도메인/논문 렌더로 변경.

다른 에이전트가 **동일한 방식으로 Research & Models 데이터를 재수집**할 수 있도록 기록한다.
상위 방법론은 [`콘텐츠-수집-분류-페이지구성-방법론.md`](./콘텐츠-수집-분류-페이지구성-방법론.md) 참조.

- 산출물: `apps/web/public/research/entities.json` (기초조사) + `icons.json` + `pages.json`
- 총 208항목: papers 62 · model-updates 73 · benchmarks-datasets 73
- 수집 스크립트 원본: `collect-research.cjs` (파싱) + summary 스크래퍼 (아래 4)

---

## 1. 출처 (정확한 repo — 그대로 재현 가능)

| category | repo (raw README) | 섹션 | 수 |
|---|---|---|---|
| **papers** | `github.com/Hannibal046/Awesome-LLM` | `## Milestone Papers` (표) | 62 |
| **model-updates** | `github.com/Hannibal046/Awesome-LLM` | `## Open LLM` (`<details><summary>org</summary>`) | 73 |
| **benchmarks-datasets** | `github.com/BenchGecko/awesome-llm-benchmarks` | 카테고리별 `## …` 섹션 | 73 |

```bash
curl -sL https://raw.githubusercontent.com/Hannibal046/Awesome-LLM/main/README.md   -o allm.md
curl -sL https://raw.githubusercontent.com/BenchGecko/awesome-llm-benchmarks/main/README.md -o bg.md
```

## 2. 파싱 패턴 (정확히 재현)

### 2.1 Papers — Milestone Papers 표
- `## Milestone Papers`부터 다음 `## `까지.
- 행: `| Date | keywords | Institute | [title](url) |`
  - 정규식: `/^\|\s*(\d{4}-\d{2})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/`
  - `date`=1, `keywords`(→tags)=2, `institute`(→company)=3, `[title](url)`=4.

### 2.2 Model Updates — Open LLM
- `## Open LLM`부터 다음 `## `까지.
- `<summary>org</summary>` → 현재 기관. 그 아래 `- [model](url)` 각 줄이 모델.
  - org: `/<summary>\s*(.+?)\s*<\/summary>/`, 모델: `/^\s*-\s*\[([^\]]+)\]\(([^)]+)\)/`.

### 2.3 Benchmarks & Datasets — BenchGecko
- `## <카테고리>` 헤더로 현재 카테고리 설정(단, `Contents`·`Leaderboards`·`Model Comparison Table`·`Contributing`·`License`는 제외).
- 항목: `- **Name** (Long Name) - description [Paper](url) | [Dataset](url)`
  - `/^\s*-\s*\*\*(.+?)\*\*\s*(.*)$/` → name=1. 뒤에서 `(Long Name)`은 태그로, ` - ` 뒤 첫 `[` 전까지 description, 첫 링크가 url.

## 3. kind & 그룹축 (수집 시 명시 — 핵심)

세 분류 모두 **kind 혼합**이다. kind는 **URL 기준으로 재판정**한다: arxiv/논문 링크 = `article`, 실제 사이트/HF/github/리더보드 = `domain`.

| category | kind 분포 | source_type | 그룹축(`domain`) |
|---|---|---|---|
| papers | **article 56 / domain 6** — 대부분 논문=article, 실제 프로젝트·제품 페이지 6개만 domain | `paper` | **주제(Theme)** — 아래 3.1 |
| model-updates | **domain 70 / article 3** — 모델 실체=domain, arxiv 논문 링크 3개만 article | `model` | **기관(org)** — `<summary>` 값 |
| benchmarks-datasets | **domain 10 / article 63** — 명명된 벤치마크라도 링크가 arxiv 논문이면 article. 실제 벤치마크 플랫폼·리더보드·데이터셋 사이트 10개만 domain, 논문 링크 63개는 article | `benchmark` | **벤치마크 카테고리** — `##` 헤더 |

### 3.1 Papers 주제 매핑 (키워드 → 8주제)
키워드(`tags[0]`)가 62개 전부 고유라 탭으로 못 묶으므로 **8개 주제로 수작업 매핑**해 `domain`에 넣는다.
분포: Pretraining & LMs(12) · Open Models(12) · Instruction & Alignment(10) · Architecture(8) · Scaling & Efficiency(7) · Evaluation & Data(6) · Reasoning(4) · Multimodal(3).
매핑 규칙(요지):
- **Architecture**: Transformers·Retro·UL2·METALM·LRU·RWKV·Mamba·Mamba2
- **Pretraining & LMs**: GPT1/2/3·BERT·T5·Codex·Gopher·LaMDA·PaLM·PaLM2·Galactica·GPT-4
- **Scaling & Efficiency**: Megatron-LM·ZeRO·Scaling Law·Switch·GLaM·Megatron-Turing·Chinchilla
- **Instruction & Alignment**: FLAN·T0·WebGPT·InstructGPT·Sparrow·Flan-T5·OPT-IML·Flan2022·Dromedary·DPO
- **Reasoning**: COT·Minerva·ToT·DeepSeek-R1
- **Multimodal**: Kosmos-1·PaLM-E·LLaVA
- **Open Models**: OPT·GLM-130B·BLOOM·LLaMA·LLaMA2·Mistral·DeepSeek-v2/V3·OLMo·OLMoE·Llama3·Qwen2.5
- **Evaluation & Data**: Foundation Models·Emergent Abilities·BIG-bench·HELM·Pythia·FineWeb

> `company`엔 기관을 그대로 보존(카드에 표시). 그룹축만 주제로.

## 4. summary(요약) — 실측 수집 (단계적, 지어내지 않음)

분류마다 소스가 달라 **3단계**로 채운다. 앞 단계에서 얻으면 다음은 생략.

**① 메타 스크래핑 (models·benchmarks 주력)**
- `og:description` → `twitter:description` → `meta[name=description]` → JSON-LD `description`.
- UA `facebookexternalhit/1.1`, `--max-time 14`, 동시성 12.
- HuggingFace=모델 카드 설명, 벤치마크 페이지=설명이 잡힌다. → model-updates 88% · benchmarks 97%.

**② arxiv API (papers 주력)** — ★ 핵심
- Papers URL은 대개 arxiv **PDF**(`/pdf/…`)라 메타가 없다. 그래서 arxiv **API로 초록**을 받는다:
  - URL에서 id 추출: `/arxiv\.org\/(?:pdf|abs)\/([0-9]{4}\.[0-9]{4,5})/`
  - `http://export.arxiv.org/api/query?id_list=<ID>` → Atom XML의 `<summary>`(=초록) 파싱, ~300자 트림.
  - arxiv URL이 아니어도(예: GPT-4·PaLM2) **제목으로 검색**: `?search_query=ti:"<title>"&max_results=1`.
- ⚠️ arxiv API는 레이트리밋이 있다. **동시성 낮게(≤3), 호출 간 3~5초** 쉬어야 빈 응답을 피한다(버스트로 실패하면 쿨다운 후 재시도).

**③ Semantic Scholar (arxiv에 없는 논문)**
- GPT-1·GPT-2처럼 arxiv에 없는 논문은 S2 Graph API: `https://api.semanticscholar.org/graph/v1/paper/search?query=<title>&limit=1&fields=abstract`.
- ⚠️ 무키(無key)라 429 잦음 → 30초+ 간격으로 재시도.

**결과**: papers 62개 거의 전부(60→62 목표) · model-updates 88% · benchmarks 97%. 못 얻으면 `description` 폴백.
스크립트: `collect-research.cjs`(파싱) → 메타 스크래퍼 → `arxiv-summaries.cjs`(초록) → S2 폴백.

## 5. 스키마 (`research/entities.json`)

```jsonc
{
  "id","category","kind","domain","name","company","description",
  "summary","tags","source_type","url","date","source"
}
```
- source_type: `paper` | `model` | `benchmark`.

## 6. JSON 구성요소 & 형식 연결

| 파일 | 역할 |
|---|---|
| `research/entities.json` | 기초조사(+summary+kind+주제 domain) |
| `research/icons.json` | 팔레트 + 벤치마크/기관/주제 테마 이모지 |
| `research/pages.json` | papers(기사형) 카드 구성 등 |

- **세 분류 모두 혼합 렌더**: 도메인 카드(프론트 정적 `StaticDomainLandscape`, `/research/entities.json`에서 kind=domain만) + 논문 목록(`CasesArticleList kind="article"`, 섹션명 "Papers").
- **model-updates**는 HuggingFace **인기 순위표(Popularity)** 를 맨 위에 유지(§8).
- 예전 백엔드 랜드스케이프(`LandscapeSection`/`RisingStar`, `generate-research-landscape.cjs`, `GET /api/<page>/landscape`)는 이제 안 씀 — 프론트 정적(`StaticDomainLandscape`)으로 전환.

## 7. 규모 주의
Research 총 208(Cases 914보다 작음). 특히 papers 62. 볼륨 확대 시 dair-ai/ML-Papers-of-the-Week 등 추가 소스 병합 가능.

---

## 8. Model Updates 인기 순위표 & 로고 (HuggingFace 실측)

Model Updates 페이지 상단의 순위표(원본 "Major Players" 포디움 디자인 재현)는 **HuggingFace 실측 인기**로 만든다. "오픈 모델 출시 수"는 인기가 아니므로 쓰지 않는다.

### 8.1 순위 기준 — HF 다운로드
- 수집한 model-updates 기관(`company`)을 **HF author handle**로 매핑(HANDLE 맵). 예: `Alibaba→Qwen`, `DeepSeek→deepseek-ai`, `Meta→meta-llama`, `Mistral AI→mistralai`, `Google→google`, `Microsoft→microsoft`, `OpenBMB→openbmb`, `Stability AI→stabilityai`, `Shanghai AI Laboratory→internlm`, `01-ai→01-ai`, `Cohere→CohereLabs`, `Nvidia→nvidia`, `AllenAI→allenai`, `Apple→apple`, `ElutherAI→EleutherAI`, `BLOOM→bigscience`, `Zhipu AI→THUDM`, `RWKV Foundation→RWKV` …
- 각 기관의 **대표(최다운로드) text-generation 모델**을 HF API로:
  `https://huggingface.co/api/models?author={handle}&filter=text-generation&sort=downloads&direction=-1&limit=3`
  → 상위 모델의 `id`·`downloads`·`likes`.
- ⚠️ **`filter=text-generation` 필수** — 없으면 google 최상위가 `electra`(구형 BERT류, 다운로드만 큼)로 잡혀 왜곡된다.
- **순위 = 대표 모델 다운로드순.** 화면엔 **7위까지**(포디움: #1 lg·#2·#3 md·나머지 sm). 지표는 다운로드·좋아요.
- 시계열(주간 변동%)은 정적 데이터라 없음 → 변동 화살표 미표시.

### 8.2 로고(대표 아이콘) 수집 — HF org 아바타
- 각 패밀리의 **공식 로고 = HuggingFace org 아바타**. 임의 이모지 금지.
- `https://huggingface.co/api/organizations/{handle}/overview` → `avatarUrl` → 이미지 다운로드 → **로컬 저장** `apps/web/public/logos/model/{slug}.{ext}` (외부 CDN 이미지 CSP 회피). `model-rank.json`의 `logo`에 로컬 경로.
- 원본 Model Updates의 `CATEGORY_LOGOS`(`/logos/openai.svg` 등)와 동일하게 **로컬 이미지**를 `<img>`로 렌더.

### 8.3 산출물 & 스크립트
- 출력: `apps/web/public/research/model-rank.json`
  ```jsonc
  { "generatedAt","source", "ranks": [ { "rank","family","org","model","model_url","downloads","likes","logo" } ] }
  ```
  스냅샷(HF 통계는 변동).
- 스크립트: `fetch-model-rank.cjs`(순위·다운로드·좋아요) → `add-logos.cjs`(org 아바타 다운로드).
- 컴포넌트: `nd-research-page.tsx`의 `ModelPopularityRank` / `PopCard` — page==="model-updates"일 때 **페이지 맨 위**에 렌더(도메인 카드·논문 목록보다 위). Rising Star는 제거됨.

---

## 9. Papers 추천 논문 픽 (Featured Paper) — 페이지 맨 위 1개

Papers 페이지 최상단에 추천 논문 1개를 픽한다. 마일스톤 논문은 시의성(최신 돌파구)이 중요하므로 **최신성 우선**.

**픽 기준 (결정적, Cases와 같은 공용 로직):**
1. **최신 연도** 논문만 후보 (date `YYYY-MM`의 연도 최대값. 현재 데이터에선 2025 = DeepSeek-R1 1편 → 자동 선정).
2. 후보가 여럿이면 **점수 최고 1개**:
   - 요약(초록) 있음: **+5**
   - **인기 주제**(domain/제목/tags에 `reasoning·open models·multimodal·instruction·alignment·scaling·architecture·agent`): **+3**
   - **대표 기관**(OpenAI·Google·Meta·DeepMind·DeepSeek·Microsoft·Mistral·Alibaba·Stanford·Ai2·NVIDIA·Anthropic): **+2**

**표시:** `PICK` 뱃지 + **"Featured Paper — The latest milestone worth reading"** + 제목·초록·기관 배지·키워드·연월.

**구현:** `nd-cases-articles-page.tsx`의 `FEATURED_CFG["papers"]`. Papers 페이지(`NDPapersPage` → `CasesArticleList base="research" page="papers" featured`)에서 렌더. Cases와 **동일 메커니즘**, 인기주제·대표기관 집합과 라벨만 다름.

**보완점(개선 여지):**
- **최신 연도에 논문이 1편뿐이면**(현재 2025=DeepSeek-R1 1편) 점수가 사실상 무의미 — 그냥 최신 1편 자동 선정. 최신성 외 **landmark 가중**(피인용 수·주제 대표성 등 외부 신호)을 더하면 "추천"의 근거가 강해진다.
- Papers 볼륨(62)이 작아 픽 다양성도 작음 → §7의 소스 보강과 연동.
