# 자료조사 재현 가이드 — Cases

다른 에이전트가 **동일한 방식으로 Cases 데이터를 재수집**할 수 있도록, 출처·수집법·JSON 구성을 기록한다.
상위 방법론은 [`콘텐츠-수집-분류-페이지구성-방법론.md`](./콘텐츠-수집-분류-페이지구성-방법론.md) 참조.

- 산출물: `apps/web/public/cases/entities.json` (기초조사) + `icons.json` + `pages.json`
- 총 914항목: case-studies 543 · domain-applications 147 · product-discovery 224

---

## 1. 출처 (실제 큐레이션 리스트, GitHub 마크다운)

| category | 출처(`source`) | 정체 | 형식 | 수 |
|---|---|---|---|---|
| **case-studies** | `ml-practical-usecases` | evidentlyai **ML System Design** DB — 100+ 회사의 ML/AI 엔지니어링 **사례 아티클**, 산업별 정리 | 회사·제목·링크·산업·연도 리스트 | 543 |
| **domain-applications** | `500-AI-Agents-Projects` | 산업/부서별 **AI 에이전트·유스케이스** 모음 | 마크다운 표(산업·유스케이스·링크) | 93 |
| | `awesome-ai-usecases` | 부서/산업별 AI 활용 | 리스트 | 37 |
| | `awesome-generative-ai` | 큐레이션 **제품** | 리스트(제품·설명·링크) | 11 |
| | `ml-practical-usecases` | (상동) | | 6 |
| **product-discovery** | `awesome-generative-ai` | 소비자 **AI 제품** | 리스트 | 123 |
| | `ml-practical-usecases` | (상동, 엔지니어링 아티클) | | 101 |

> 출처는 전부 GitHub의 **awesome-* / curated 리스트**. 이름으로 검색해 최신 README(raw)를 받는다.
> 예: `curl -sL https://raw.githubusercontent.com/<owner>/<repo>/main/README.md`

## 2. 수집 절차

1. **README(raw) 다운로드** → 스크래치패드에 저장.
2. **마크다운 파싱**(node 스크립트)으로 항목 추출:
   - 표: `| 회사 | 제목/링크 | 산업 | 연도 |` → 셀 분리, `[text](url)`에서 제목·링크.
   - 리스트: `- [name](url) — description` → 정규식 `/^\s*-\s*\[([^\]]+)\]\(([^)]+)\)\s*[—-]?\s*(.*)$/`.
3. **정규화**: `domain`은 원본 산업/도메인 문자열의 **첫 값**(콤마 분리). id는 `case-####` 또는 `slug(name)`.
4. **중복 제거**: id 기준, `url` 없는 항목 제외.

## 3. kind 판별 (수집 시 명시 — 필수)

```
kind = (source_type === "product") ? "domain" : "article"
```
- article: `engineering-blog` · `blog` · `conference` · `paper`
- domain : `product`
- 결과: case-studies 543 article / domain-applications 43 article·104 domain / product-discovery 101 article·123 domain
  → case-studies=기사 단일, 나머지 둘=혼합.

## 4. summary(요약) — 실측 스크래핑 (지어내지 않음)

- 각 `url`에서 `og:description` → `twitter:description` → `meta[name=description]` → JSON-LD `description` 순 추출.
- UA는 `facebookexternalhit/1.1` (medium 등 봇차단 회피에 유효). `--max-time 14`, 동시성 12.
- 실패 시 비움 → 화면은 `summary || description`로 폴백. **추정/생성 금지.**
- 결과 커버리지: case-studies 76% · domain-applications 78% · product-discovery 57%.

## 5. 스키마 (`cases/entities.json`)

```jsonc
{
  "id","category","kind","domain","name","company","description",
  "summary","tags","source_type","url","date","verified","source"
}
```

## 6. JSON 구성요소 (3층)

| 파일 | 역할 |
|---|---|
| `cases/entities.json` | 기초조사(데이터+summary+kind) |
| `cases/icons.json` | 8색 팔레트 + 테마 이모지 풀 |
| `cases/pages.json` | 분류별 title·subtitle·tabs·card필드·**domainMap**·source_type 라벨 |

- **도메인 정규화**: domain-applications 원본 65개 → `pages.json`의 `domainMap`으로 **17개**로 통합(예: `Software Dev`/`Web Development`/`IT` → `Software & IT`). 미매핑은 `Other`.

## 7. 대표 기사 픽 (Featured Read) — 페이지 맨 위 1개

Case Studies 페이지 최상단에 대표 기사 1개를 픽해 보여준다(스타/조회수 지표가 없으므로 보유 데이터로 점수화).

**픽 기준 (결정적):**
1. **최신 연도** 기사만 후보로 (date의 첫 4자리 연도 최대값. 예: 2025).
2. 후보 중 **점수 최고 1개**:
   - 요약(summary) 있음(길이 > 40): **+5**
   - **인기 주제** 포함(제목·태그·domain에 `llm/agent/rag/generative/multimodal/prompt/fine-tune/diffusion/embedding/vector/gpt`): **+3**
   - **인지도 회사**(Netflix·Uber·Meta·Google·Airbnb·LinkedIn·Instacart·DoorDash·Stripe·Dropbox·Pinterest·Amazon·Microsoft·Nvidia·Grammarly·Canva·Ramp 등): **+2**
3. 동점이면 원본 순서(안정 정렬) → 매번 같은 결과.

**표시:** `PICK` 뱃지 + **"Featured Read — Worth reading right now"** + 제목·요약·회사 배지·태그·연도. Rising Star와 같은 위치·톤이지만 기사라서 문구를 달리함.

**구현:** `nd-cases-articles-page.tsx`의 `FEATURED_CFG["case-studies"]` + `CasesArticleList`(`featured` 프롭). 혼합 페이지(domain-applications/product-discovery)의 기사 섹션엔 미표시.

**보완점(개선 여지):**
- **요약 품질**: 픽된 기사의 `summary`가 og:description이라 가끔 **저자 나열**("Zhibo Fan | ML Engineer …")이 잡힌다. → 저자 나열형(이름·직함 패턴, `\|.*Engineer` 등)을 감점하거나, 실요약 있는 기사를 우선하도록 보정 여지.
- **notable 회사 리스트**가 코드에 하드코딩 → 새 회사 등장 시 갱신 필요(방법론상 pages.json로 이전 여지, 아래 방법론 문서 참조).

## 8. 관련 파일

- 랜드스케이프 생성(도메인형): `apps/api/scripts/generate-cases-landscape.cjs` (kind=domain만, 정규화, best5)
- 화면: `apps/web/components/cherry/nd-cases-page.tsx`·`nd-cases-articles-page.tsx`·`nd-cases-best-page.tsx`
