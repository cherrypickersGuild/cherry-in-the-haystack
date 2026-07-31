# 자료조사 재현 가이드 — Research & Models

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

세 분류 모두 **단일 kind (혼합 없음)**.

| category | kind | source_type | 그룹축(`domain`) |
|---|---|---|---|
| papers | **article** (논문=글) | `paper` | **주제(Theme)** — 아래 3.1 |
| model-updates | **domain** (모델=산출물) | `model` | **기관(org)** — `<summary>` 값 |
| benchmarks-datasets | **domain** (리소스) | `benchmark` | **벤치마크 카테고리** — `##` 헤더 |

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

- **Papers(article)** → 기사형(pill 탭 = 8주제).
- **Model Updates / Benchmarks(domain)** → 도메인형 랜드스케이프(기관 / 카테고리 8카드 × best5 + 모달).
- 랜드스케이프 생성: `generate-research-landscape.cjs`(kind=domain만), 백엔드 `LANDSCAPE_PAGES`에 `model-updates`·`benchmarks-datasets` 등록 → `GET /api/<page>/landscape`.

## 7. 규모 주의
Research 총 208(Cases 914보다 작음). 특히 papers 62. 볼륨 확대 시 dair-ai/ML-Papers-of-the-Week 등 추가 소스 병합 가능.
