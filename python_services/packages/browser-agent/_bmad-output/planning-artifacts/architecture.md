---
stepsCompleted: [1, 2, 3, 4]
status: revised
completedDate: '2026-05-23'
revisedDate: '2026-05-23'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-browser-agent-2026-05-23/prd.md
  - _bmad-output/planning-artifacts/prds/prd-browser-agent-2026-05-23/addendum.md
  - cherry-in-the-haystack/docs/architecture/ddl-v1.1.sql
  - cherry-in-the-haystack/docs/architecture/data-architecture.md
  - cherry-in-the-haystack/docs/architecture/technology-stack-details.md
  - cherry-in-the-haystack/docs/architecture/api-contracts.md
  - cherry-in-the-haystack/docs/architecture/implementation-patterns.md
  - cherry-in-the-haystack/docs/architecture/architecture-decision-records-adrs.md
workflowType: 'architecture'
scope: 'targeted-adr'
project_name: 'browser-agent'
user_name: 'yglee730'
date: '2026-05-23'
---

# Architecture Decision Document — browser-agent (Targeted ADR)

_Targeted ADR covering the 4 unresolved decisions blocking F-2, F-3, F-4, F-7 implementation. This is not a full system redesign — it attaches new components to the existing cherry-in-the-haystack pipeline architecture._

_Sections are appended as each decision is resolved collaboratively._

---

## Project Context Analysis

### Requirements Overview — Scoped to 4 Decisions

**Functional Requirements (directly impacted):**

| FR | Decision it blocks |
|----|--------------------|
| FR-2.2 — analysis output stored as structured JSON, linked to `content.source` | D-1: `crawler_analysis` schema |
| FR-2.4 — analysis JSON contract: selectors + pagination_type + dynamic_load + notes | D-1: `crawler_analysis` schema |
| FR-2.5 — prompt version stored alongside analysis record | D-1: `crawler_analysis` schema |
| FR-3.2 — generated code stored in `crawler_registry`, status tracked | D-2: `crawler_registry` schema |
| FR-3.3 — PR auto-opened targeting `newly-discovered/sources/generated/` | D-3: PR automation |
| FR-3.4 — PR description: source name, analysis summary, key selectors, timestamp | D-3: PR automation |
| FR-7.4 — broken crawler marked `status: deprecated` | D-2: `crawler_registry` schema |
| FR-1.4 — Notion sync reads URL entries, upserts new sources to YAML config | D-4: Notion mapping |

**NFRs that constrain design:**
- **NFR-1** (cost): browser-use invoked ≤ 1× per source per stable period — `crawler_analysis`가 존재하면 Python 호출 스킵
- **NFR-4** (reviewability): PR 코드는 human-readable TypeScript
- **NFR-5** (security): 생성된 crawler 파일에 credentials 미포함, env var 패턴만 사용

**Scale & Complexity:** 2개 신규 테이블 + Python 서비스 엔드포인트 2개 + TypeScript PR 확장 + Notion 필드 매핑 2개 DB. 복잡도: Medium.

### Technical Constraints & Dependencies

- `content` 스키마 유지 (FK 정합성)
- UUID v7 PK, JSONB shape CHECK, singular 테이블명, `TIMESTAMPTZ` 전 컬럼
- `core.run_log` 연동: `run_kind_enum`에 `CRAWLER_ANALYSIS`, `CRAWLER_GENERATION` 추가 필요
- Python FastAPI port 8000 기존 서비스 확장
- `GitHubCommitter` 인터페이스 확장 (`createPullRequest` 추가)
- GitHub bot account: `handbook-bot`

### Cross-Cutting Concerns

- `crawler_registry.status` (pending_review → active → deprecated)가 스케줄러 실행 여부의 단일 진실 공급원
- `content.source.consecutive_failures`는 범용 fetch 실패 카운터 — Playwright 전용 실패 카운터는 `crawler_registry.consecutive_failures`로 분리
- `core.prompt_template_version`과의 FK 연결로 분석 프롬프트 버전 추적

---

## Core Architectural Decisions

### ADR-011: `content.crawler_analysis` 테이블 스키마

**Decision:** `content` 스키마 내 1:1(source당 단일 행, UPDATE in-place) 구조로 생성.

```sql
CREATE TABLE content.crawler_analysis (
    id                         UUID NOT NULL,
    source_id                  UUID NOT NULL,

    -- FR-2.4 contract
    analysis_json              JSONB NOT NULL,
    -- required shape: {
    --   content_selector: string,   title_selector: string,
    --   date_selector: string,      author_selector: string,
    --   url_selector: string,       pagination_type: 'none'|'click'|'scroll',
    --   dynamic_load: boolean,      notes: string
    -- }

    -- FR-2.5 prompt versioning
    prompt_template_version_id UUID NULL,
    model_name                 VARCHAR(100) NULL,
    run_log_id                 UUID NULL,

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_crawler_analysis_source
        FOREIGN KEY (source_id) REFERENCES content.source(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_crawler_analysis_prompt_version
        FOREIGN KEY (prompt_template_version_id)
            REFERENCES core.prompt_template_version(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_crawler_analysis_run_log
        FOREIGN KEY (run_log_id) REFERENCES core.run_log(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_crawler_analysis_json_is_object
        CHECK (jsonb_typeof(analysis_json) = 'object')
);

CREATE UNIQUE INDEX uq_crawler_analysis_source
    ON content.crawler_analysis (source_id);

CREATE INDEX idx_crawler_analysis_source
    ON content.crawler_analysis (source_id);

CREATE TRIGGER trg_crawler_analysis_set_updated_at
    BEFORE UPDATE ON content.crawler_analysis
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

**Rationale:** 재분석 빈도가 낮고 (failure 시에만), `run_log_id` + `prompt_template_version_id`로 감사 추적이 충분하므로 1:1로 단순화. 스케줄러가 `WHERE source_id = ?` 단순 조회로 동작.

**Constraint:** `analysis_json` shape는 F-3 코드 생성의 직접 입력값이므로 shape 변경 시 `crawler_generation` 프롬프트도 함께 갱신 필요.

---

### ADR-012: `content.crawler_registry` 테이블 스키마

**Decision:** `content` 스키마 내 1:many(source당 다수 행, 상태로 구분) 구조로 생성. Playwright 전용 실패 카운터를 이 테이블에 위치.

```sql
CREATE TYPE content.crawler_status_enum AS ENUM (
    'pending_review',
    'active',
    'deprecated'
);

CREATE TABLE content.crawler_registry (
    id                   UUID NOT NULL,
    source_id            UUID NOT NULL,
    analysis_id          UUID NULL,

    status               content.crawler_status_enum NOT NULL DEFAULT 'pending_review',
    generated_code       TEXT NOT NULL,

    -- PR tracking (FR-3.3, FR-3.4)
    pr_number            INT NULL,
    pr_url               VARCHAR(1000) NULL,
    pr_merged_at         TIMESTAMPTZ NULL,

    -- F-7 Playwright-specific failure counter
    -- separate from content.source.consecutive_failures (which resets on any success incl. fallback)
    consecutive_failures INT NOT NULL DEFAULT 0,

    run_log_id           UUID NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_crawler_registry_source
        FOREIGN KEY (source_id) REFERENCES content.source(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_crawler_registry_analysis
        FOREIGN KEY (analysis_id) REFERENCES content.crawler_analysis(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_crawler_registry_run_log
        FOREIGN KEY (run_log_id) REFERENCES core.run_log(id)
            ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- source당 active crawler는 최대 1개
CREATE UNIQUE INDEX uq_crawler_registry_source_active
    ON content.crawler_registry (source_id)
    WHERE (status = 'active');

CREATE INDEX idx_crawler_registry_source
    ON content.crawler_registry (source_id);

CREATE INDEX idx_crawler_registry_active
    ON content.crawler_registry (status)
    WHERE (status = 'active');

CREATE TRIGGER trg_crawler_registry_set_updated_at
    BEFORE UPDATE ON content.crawler_registry
    FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

**run_kind_enum 확장:**

```sql
ALTER TYPE core.run_kind_enum ADD VALUE 'CRAWLER_ANALYSIS';
ALTER TYPE core.run_kind_enum ADD VALUE 'CRAWLER_GENERATION';
```

**Rationale:** 1:many로 crawler 이력 보존. `consecutive_failures`를 `crawler_registry`에 둔 이유: `content.source.consecutive_failures`는 fallback 성공 시 리셋되므로 Playwright 전용 재생성 트리거와 의미가 다름. 신규 crawler 배포 시 새 행 삽입 → 카운터 자동 0 리셋.

**Status lifecycle:**
```
INSERT (pending_review)
  → PR merged → UPDATE status = 'active'
  → 연속 실패 ≥ threshold → UPDATE status = 'deprecated' + 새 pending_review 행 INSERT
```

---

### ADR-013: Python(browser-use) ↔ TypeScript 통합 경계

**Decision:** 기존 `python_services/api` FastAPI 서비스(port 8000)에 신규 라우터 추가. TypeScript 오케스트레이터가 HTTP로 호출. subprocess 및 별도 서비스 방식 불채택.

**새 라우터:** `python_services/api/routers/crawler.py`

**API 계약:**

```
POST /crawler/analyze
  Request:  { "source_id": string, "url": string }
  Response: { "analysis_id": string, "analysis_json": CrawlerAnalysisShape }
  Timeout:  60s
  On error: 422 { "error": string, "detail": string }

POST /crawler/generate
  Request:  { "source_id": string, "analysis_id": string, "source_name": string }
  Response: { "registry_id": string, "generated_code": string }
  Timeout:  30s
  On error: 422 { "error": string, "detail": string }
```

**TypeScript 오케스트레이터 흐름:**

```
[TS Scheduler — daily cycle]
  │
  ├─ SELECT * FROM content.crawler_analysis WHERE source_id = ?
  │    └─ 없으면 → POST :8000/crawler/analyze
  │                  └─ UPSERT content.crawler_analysis
  │
  ├─ SELECT * FROM content.crawler_registry WHERE source_id = ? AND status = 'active'
  │    └─ 없고 pending_review도 없으면 → POST :8000/crawler/generate
  │                                        └─ INSERT content.crawler_registry (pending_review)
  │                                        └─ GitHubCommitter.createPullRequest(...)
  │
  └─ [PR merged 감지 시] → UPDATE crawler_registry SET status = 'active'
```

**browser-use 세션:** per-request (요청마다 브라우저 인스턴스 생성/종료). 호출 빈도 낮음(≤1×/source/stable period)으로 오버헤드 수용.

**Rationale:** ADR-006(TypeScript = 오케스트레이션, Python = LLM), ADR-010(HTTP 통신, port 8000)과 완전 정합. subprocess는 ADR-010 위반이며 타임아웃·프로세스 관리 부담 큼.

---

### ADR-014: PR 자동화 메커니즘

**Decision:** `GitHubCommitter` 인터페이스에 `createPullRequest()` 추가. Octokit 기반, `handbook-bot` 계정, `feature/browser-crawl-agent` 브랜치 타깃.

**인터페이스 확장:**

```typescript
// packages/pipeline/src/publication/github-committer.ts
interface GitHubCommitter {
  commitFiles(
    files: { path: string; content: string }[],
    message: string
  ): Promise<string>

  createPullRequest(params: {
    branch: string          // feat/crawler/{source_name_kebab}
    title: string
    body: string
    files: { path: string; content: string }[]
  }): Promise<{ prNumber: number; prUrl: string }>
}
```

**생성 파일 경로 (FR-3.3):**
```
packages/pipeline/src/newly-discovered/sources/generated/{source_name_kebab}.ts
```

**PR 설정:**
- base branch: `feature/browser-crawl-agent`
- head branch: `feat/crawler/{source_name_kebab}`
- commit account: `handbook-bot`
- commit message: `feat(crawler): add generated crawler for {source_name}`

**중복 PR 처리:** 동일 source에 `pending_review` 레코드 존재 시:
1. 기존 PR → Octokit `pulls.update({ state: 'closed' })`
2. 기존 `crawler_registry` row → `UPDATE status = 'deprecated'`
3. 새 `pending_review` 행 INSERT + 새 PR 오픈

**Rationale:** Octokit은 이미 파이프라인에서 사용 중. `feature/browser-crawl-agent`를 base로 지정하여 generated crawler PR이 main에 직접 영향 없이 별도 검토 가능.

---

### ADR-015: Notion Source Registry 필드 매핑 (OQ-7 해소)

**Decision:** 두 개의 Notion DB를 sync 대상으로 확정. URL 속성명 차이를 config-driven 방식으로 처리.

| 항목 | LinkedIn DB | Custom Crawl DB |
|------|-------------|-----------------|
| **DB ID** | `342f199edf7c803ebb2cfcb30bd492e3` | `340f199edf7c80cabc78f94853d2c426` |
| **URL 속성명** | `Linkedin` | `URL` |
| **Source name 속성명** | `Name` | `Name` |
| **Source type 속성명** | `source_type` | `source_type` |
| **browser_use_only 속성명** | `browser_use_only` | `browser_use_only` |

**Sync job 설정:**

```typescript
const NOTION_SOURCE_DB_CONFIGS = [
  {
    databaseId: '342f199edf7c803ebb2cfcb30bd492e3',
    urlProperty: 'Linkedin',
    nameProperty: 'Name',
    sourceTypeProperty: 'source_type',
    browserUseOnlyProperty: 'browser_use_only',
  },
  {
    databaseId: '340f199edf7c80cabc78f94853d2c426',
    urlProperty: 'URL',
    nameProperty: 'Name',
    sourceTypeProperty: 'source_type',
    browserUseOnlyProperty: 'browser_use_only',
  },
] as const
```

**주의사항:**
- `source_type` 속성값이 `content.source_type_enum` 값과 일치하는지 첫 sync 전 검증 필요
- `browser_use_only` Notion 속성 타입이 checkbox인지 확인 (boolean 파싱)
- FR-1.4: 신규 source만 upsert, 기존 source 수정 없음

**Rationale:** `NOTION_SOURCE_DB_CONFIGS` 배열로 관리하여 향후 DB 추가 시 코드 변경 없이 config 확장만으로 대응 가능.

---

## Revision: crawl4ai 실행층 통합 (2026-05-23)

_browser-use는 지능층(분석)으로 유지. crawl4ai가 TypeScript Playwright를 대체하는 실행층으로 추가. 역할 분리: browser-use = "어떻게 크롤링할지 파악", crawl4ai = "파악한 방법으로 실제 크롤링 실행"._

_변경 ADR: ADR-011-R1, ADR-013-R1, ADR-014-R1. 변경 없음: ADR-012, ADR-015._

---

### ADR-011-R1: `analysis_json` 계약 확장

**변경:** crawl4ai 실행 힌트 필드 3개 추가. DB DDL 변경 없음 — `chk_crawler_analysis_json_is_object`는 object 타입만 검증하므로 애플리케이션 레벨 계약 확장으로 충분.

**updated `analysis_json` shape:**

```json
{
  "content_selector":  "string",
  "title_selector":    "string",
  "date_selector":     "string",
  "author_selector":   "string",
  "url_selector":      "string",
  "pagination_type":   "none|click|scroll",
  "dynamic_load":      "boolean",
  "notes":             "string",

  "wait_for":   "string|null",
  "js_code":    "string|null",
  "magic_mode": "boolean"
}
```

신규 필드 의미:
- `wait_for`: crawl4ai가 HTML 캡처 전 기다릴 조건. CSS(`"css:.article-list"`) 또는 JS 표현식(`"js:()=>window.loaded"`)
- `js_code`: 페이지 로드 후 실행할 JS 스니펫 — infinite scroll 트리거, lazy load 해제 등
- `magic_mode`: `true`이면 crawl4ai `magic=True` 활성화 (Cloudflare, DataDome 우회)

**browser-use 분석 프롬프트 업데이트 필요:** 분석 시 위 3개 필드를 함께 판단하도록 `CRAWLER_ANALYSIS` 프롬프트 갱신. 판단 근거:
- `dynamic_load=true`이면 `wait_for`를 구체적 CSS/JS 조건으로 명시
- pagination_type이 `scroll`이면 `js_code`에 스크롤 트리거 JS 제시
- bot-detection 징후(403, JS 챌린지, empty body) 감지 시 `magic_mode=true`

**Constraint 변경 없음:** 신규 필드는 nullable — 기존 `crawler_analysis` 레코드와 backward-compatible. 재분석 없이 신규 크롤러 생성 시 신규 필드는 `null`로 처리.

---

### ADR-013-R1: Python(browser-use + crawl4ai) ↔ TypeScript 통합 경계

**변경:** `/crawler/analyze`(browser-use) 변경 없음. `/crawler/generate`가 TypeScript Playwright 대신 Python crawl4ai 스크립트를 생성. `/crawler/execute` 신규 추가.

**라우터:** `python_services/api/routers/crawler.py` (기존 파일 확장)

**API 계약:**

```
POST /crawler/analyze          (변경 없음 — browser-use)
  Request:  { "source_id": string, "url": string }
  Response: { "analysis_id": string, "analysis_json": CrawlerAnalysisShape }
  Timeout:  60s

POST /crawler/generate         (변경 — 생성 대상: TS Playwright → Python crawl4ai)
  Request:  { "source_id": string, "analysis_id": string, "source_name": string }
  Response: { "registry_id": string, "generated_code": string }
  Timeout:  30s
  내부 동작:
    1. crawler_analysis에서 analysis_json 로드
    2. analysis_json 셀렉터 → JsonCssExtractionStrategy 스키마 변환
    3. crawl4ai Python 스크립트 템플릿 렌더링
    4. INSERT crawler_registry (generated_code = Python 스크립트)
  On error: 422 { "error": string, "detail": string }

POST /crawler/execute          (신규 — crawl4ai 실행)
  Request:  { "source_id": string }
  Response: { "items": CrawledItem[], "source_id": string }
  Timeout:  30s
  내부 동작:
    1. crawler_registry WHERE source_id = ? AND status = 'active' → generated_code 로드
    2. generated_code에서 CRAWL_CONFIG 동적 임포트
    3. AsyncWebCrawler(config=browser_config).arun(url, config=CRAWL_CONFIG)
    4. 구조화된 콘텐츠 반환
  On error: 422 { "error": string, "detail": string }
```

**crawl4ai 서비스 설계 요점:**

```python
# FastAPI 앱 수명 동안 BrowserConfig 싱글턴 (per-request spawn 제거)
browser_config = BrowserConfig(headless=True, verbose=False)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.browser_config = BrowserConfig(headless=True, verbose=False)
    yield
    # 브라우저 정리는 AsyncWebCrawler context manager가 처리

@router.post("/crawler/execute")
async def execute_crawler(req: ExecuteRequest, request: Request):
    registry = await db.get_active_crawler(req.source_id)
    crawl_config = load_crawl_config_from_code(registry.generated_code)
    async with AsyncWebCrawler(config=request.app.state.browser_config) as crawler:
        result = await crawler.arun(url=registry.source_url, config=crawl_config)
    return parse_crawl_result(result)
```

**생성 Python 스크립트 형식 (템플릿):**

```python
# python_services/crawlers/generated/{source_name_kebab}.py
# Generated by /crawler/generate — do not edit manually.

from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
from crawl4ai import CrawlerRunConfig

EXTRACTION_SCHEMA = {
    "name": "{source_name}",
    "baseSelector": "{content_selector}",
    "fields": [
        {"name": "title",   "selector": "{title_selector}",  "type": "text"},
        {"name": "url",     "selector": "{url_selector}",    "type": "attribute", "attribute": "href"},
        {"name": "date",    "selector": "{date_selector}",   "type": "attribute", "attribute": "datetime"},
        {"name": "author",  "selector": "{author_selector}", "type": "text"},
        {"name": "content", "selector": "{content_selector}","type": "text"},
    ]
}

CRAWL_CONFIG = CrawlerRunConfig(
    extraction_strategy=JsonCssExtractionStrategy(EXTRACTION_SCHEMA),
    wait_for="{wait_for}",    # analysis_json.wait_for (None if null)
    js_code={js_code},        # analysis_json.js_code (None if null)
    magic={magic_mode},       # analysis_json.magic_mode
    cache_mode="bypass",
)
```

**Rationale:**
- browser-use = 지능층. LLM이 사이트를 탐색하며 셀렉터/동작 조건 파악 → 1회 호출 후 재사용 (NFR-1)
- crawl4ai = 실행층. 파악된 셀렉터로 LLM 없이 CSS 기반 결정론적 추출 → 반복 실행 비용 0 (NFR-1 추가 절감)
- `BrowserConfig` 싱글턴으로 브라우저 프로세스 재사용 → per-request spawn 오버헤드 제거
- ADR-006(TS=오케스트레이션, Python=LLM/브라우저), ADR-010(HTTP port 8000) 정합 유지

---

### ADR-014-R1: PR 자동화 — 생성 파일 형식 변경

**변경:** 생성 파일이 TypeScript → Python. base branch, commit account, `GitHubCommitter` 인터페이스 변경 없음.

**생성 파일 경로 (변경):**

```
변경 전: packages/pipeline/src/newly-discovered/sources/generated/{source_name_kebab}.ts
변경 후: python_services/crawlers/generated/{source_name_kebab}.py
```

**PR 설정 (유지):**

```
base branch:    feature/browser-crawl-agent
head branch:    feat/crawler/{source_name_kebab}
commit account: handbook-bot
commit message: feat(crawler): add generated crawler for {source_name}
```

**PR body 확장 (crawl4ai 설정 필드 추가):**

```
Source:        {source_name}
Analysis ID:   {analysis_id}
Key selectors: baseSelector={content_selector}
Pagination:    {pagination_type}
crawl4ai:      wait_for={wait_for}, magic={magic_mode}
Generated at:  {timestamp}
```

**`GitHubCommitter` 인터페이스 변경 없음:** `createPullRequest()` 시그니처 동일. `files[].path` 값만 `.ts` → `.py`로 변경.

**Rationale:** 실행층이 Python으로 전환되면 생성 코드도 Python으로 통일. PR은 여전히 human-reviewable — 셀렉터, crawl4ai 설정값을 직접 확인 후 머지 결정 가능. NFR-4(reviewability) 유지.

---

### 변경 후 전체 오케스트레이터 흐름

```
[TS Scheduler — daily cycle]
  │
  ├─ SELECT * FROM content.crawler_analysis WHERE source_id = ?
  │    └─ 없으면 → POST :8000/crawler/analyze        (browser-use, 변경 없음)
  │                  └─ UPSERT crawler_analysis       (analysis_json + wait_for/js_code/magic_mode)
  │
  ├─ SELECT * FROM content.crawler_registry WHERE source_id = ? AND status IN ('active','pending_review')
  │    └─ 없으면 → POST :8000/crawler/generate        (Python crawl4ai 스크립트 생성)
  │                  └─ INSERT crawler_registry        (generated_code = Python)
  │                  └─ GitHubCommitter.createPullRequest(*.py)
  │
  ├─ [PR merged 감지 시] → UPDATE crawler_registry SET status = 'active'
  │
  └─ [콘텐츠 수집 주기] → POST :8000/crawler/execute  (신규 — crawl4ai 실행)
                            └─ { items: CrawledItem[] } → 기존 ingestion 파이프라인

ADR 변경 요약:
  ADR-011  ──R1──▶  analysis_json 계약 확장 (wait_for, js_code, magic_mode)
  ADR-013  ──R1──▶  /crawler/generate: TS Playwright → Python crawl4ai 스크립트
                     /crawler/execute: 신규 엔드포인트 추가
  ADR-014  ──R1──▶  generated 파일: .ts → .py, 경로 변경
  ADR-012, ADR-015: 변경 없음
```
