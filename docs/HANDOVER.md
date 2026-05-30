# browser-agent 프로젝트 인수인계 문서

> 작성일: 2026-05-30  
> 목적: 이 문서 하나로 프로젝트 전체를 파악하고 이어서 작업할 수 있도록 한다.

---

## 1. 프로젝트 한 줄 요약

**Notion에 URL을 등록하면, AI가 자동으로 해당 사이트의 크롤러를 생성하고, 매일 기사를 수집해 DB에 저장하는 파이프라인.**

기존 `cherry-in-the-haystack` 리포지토리의 파이프라인에 **browser-agent** 기능을 추가한 프로젝트다.

---

## 2. 시스템 구성요소

```
┌──────────────┐     ┌──────────────────────────────┐     ┌──────────────────────┐
│    Notion    │     │   Node.js Pipeline            │     │   Python Service     │
│  (소스 등록) │────▶│   packages/pipeline/          │────▶│   python_services/   │
│              │     │   - notion-sync job           │     │   FastAPI (port 8000)│
│  LinkedIn DB │     │   - browser-crawl job         │     │   POST /analyze      │
│  Custom DB   │     │   - github-committer          │     │   POST /generate     │
└──────────────┘     │   - crawler-db                │     │   POST /execute      │
                     └──────────────────────────────┘     │   POST /fallback     │
                                    │                      └──────────────────────┘
                     ┌──────────────▼──────────────┐
                     │        GitHub Repo           │
                     │  - sources.yaml (소스 목록)  │
                     │  - generated/*.py (크롤러)   │
                     └──────────────┬──────────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │       PostgreSQL DB          │
                     │  content.source              │
                     │  content.crawler_analysis    │
                     │  content.crawler_registry    │
                     │  content.article_raw         │
                     └─────────────────────────────┘
```

### 기술 스택

| 레이어 | 기술 |
|--------|------|
| 오케스트레이션 | TypeScript (Node.js) |
| AI 분석 / 폴백 수집 | Python + browser-use + Claude (Anthropic) |
| 정적 크롤링 실행 | Python + crawl4ai |
| DB | PostgreSQL (asyncpg / node-postgres) |
| GitHub 자동화 | Octokit (`handbook-bot` 계정) |
| Notion 연동 | @notionhq/client |

---

## 3. 전체 데이터 흐름

### Phase 1 — 소스 등록 (Notion → sources.yaml)

```
① 사람이 Notion에 URL 입력
   └─ LinkedIn DB (342f199edf7c803ebb2cfcb30bd492e3): Linkedin 속성
   └─ Custom Crawl DB (340f199edf7c80cabc78f94853d2c426): URL 속성

② 매일 notion-sync job 실행
   - 두 DB 전체 쿼리 (페이지네이션 포함)
   - URL / Name / source_type / browser_use_only 추출
   - 필수 필드 없음 또는 유효하지 않은 source_type → skip
   - 이미 sources.yaml에 있는 URL → skip

③ 신규 소스를 sources.yaml에 append
   GitHub PR 자동 생성 (브랜치: feat/notion-sync/YYYY-MM-DD)
```

### Phase 2 — 크롤러 자동 생성 (sources.yaml → 크롤러 코드)

```
④ 매일 browser-crawl job 실행
   sources.yaml 로드 → 각 소스 DB 상태 확인

⑤ 신규 소스 (DB에 registry 없음) → 온보딩 파이프라인:

   POST /crawler/analyze (60초 타임아웃)
   └─ browser-use Agent가 실제 브라우저로 사이트 열어 분석
   └─ Claude AI가 CSS 셀렉터, 페이지네이션, 봇 감지 여부 파악
   └─ 결과를 content.crawler_analysis 에 UPSERT

   POST /crawler/generate (30초 타임아웃)
   └─ 분석 결과를 Python crawl4ai 스크립트로 변환 (LLM 없이 순수 템플릿)
   └─ content.crawler_registry 에 INSERT (status: pending_review)

   GitHub PR 자동 생성
   └─ python_services/crawlers/generated/{kebab-name}.py
   └─ crawler_registry에 pr_number, pr_url 저장

⑥ pending_review 소스 → 매 cycle마다 GitHub API로 PR 머지 여부 폴링
   └─ merged_at 있음 → status = 'active'
   └─ 미머지 → 대기
```

### Phase 3 — 매일 기사 수집 (active 크롤러 실행)

```
⑦ browser_use_only = false 소스 (active 크롤러 있음):
   POST /crawler/execute (30초 타임아웃)
   └─ DB에서 generated_code 로드 → exec()으로 동적 실행
   └─ crawl4ai CSS 셀렉터로 기사 목록 추출

⑧ browser_use_only = true 소스 (LinkedIn 포함, 매 cycle):
   POST /crawler/fallback (60초 타임아웃)
   └─ browser-use Agent가 브라우저 직접 조작해 기사 추출

⑨ 기사 처리 공통 흐름:
   유효성 검사 → 중복 제거(SHA-256 해시) → article_raw INSERT

⑩ crawl4ai 실행 실패 시:
   crawler_registry.consecutive_failures 증가
   └─ 임계값(기본 3회) 도달 → status = 'deprecated'
   └─ 재생성 파이프라인 자동 실행 (analyze → generate → PR)
   └─ 재생성 대기 중에도 fallback으로 기사 계속 수집
```

---

## 4. 핵심 설계 원칙

### browser_use_only 플래그

| 값 | 동작 |
|----|------|
| `true` | crawl4ai 크롤러 생성 안 함. 매 cycle마다 browser-use AI가 직접 수집 |
| `false` (기본) | 최초 1회 analyze → generate → PR. PR 머지 후 crawl4ai로 매일 실행 |

- **LINKEDIN** source_type은 자동으로 `browser_use_only = true`

### 역할 분담 (ADR-006)

- **TypeScript** = 오케스트레이션 (스케줄링, DB 상태 판단, GitHub PR)
- **Python** = AI/브라우저 작업 (browser-use 분석, crawl4ai 실행, fallback)

### 크롤러 실행 방식

DB의 `crawler_registry.generated_code`에 저장된 Python 코드를 `exec()`으로 동적 실행한다. GitHub 파일은 코드 리뷰/버전 관리용이고, **실제 실행은 DB에서 직접 로드**한다.

---

## 5. 파일 구조

```
browser/
├── packages/pipeline/
│   ├── src/
│   │   ├── jobs/
│   │   │   ├── notion-sync.ts          # Notion → sources.yaml → GitHub PR
│   │   │   └── browser-crawl.ts        # 온보딩 + 실행 + 실패처리 (메인 오케스트레이터)
│   │   ├── config/
│   │   │   └── source-config.ts        # sources.yaml 스키마 정의 및 검증 (zod)
│   │   ├── db/
│   │   │   └── crawler-db.ts           # 모든 PostgreSQL 쿼리 함수
│   │   └── publication/
│   │       └── github-committer.ts     # GitHub PR/커밋 자동화 (Octokit)
│   └── config/
│       └── sources.yaml                # 크롤링 소스 목록 (사람 + 자동 관리)
│
├── python_services/
│   └── api/
│       ├── main.py                     # FastAPI 앱 (port 8000), BrowserConfig 싱글턴
│       ├── routers/crawler.py          # 4개 엔드포인트 구현
│       ├── models/crawler.py           # Pydantic 요청/응답 모델
│       ├── db/client.py                # asyncpg DB 헬퍼
│       └── prompts/
│           ├── crawler_analysis.py     # 사이트 분석용 AI 프롬프트
│           └── crawler_fallback.py     # 폴백 수집용 AI 프롬프트
│
├── db/migrations/
│   ├── 20260523000001_add_crawler_tables.sql    # crawler_analysis, crawler_registry 생성
│   └── 20260525000001_add_crawler_fallback_enum.sql  # CRAWLER_FALLBACK enum 추가
│
└── _bmad-output/                       # 기획/설계 문서 (변경 금지)
    ├── planning-artifacts/
    │   ├── architecture.md             # ADR (아키텍처 결정 기록)
    │   └── epics.md                    # 전체 요구사항 및 에픽/스토리 목록
    └── implementation-artifacts/
        ├── sprint-status.yaml          # 현재 진행 상태
        └── *.md                        # 각 스토리별 상세 구현 가이드
```

---

## 6. 환경 설정

### `python_services/.env`

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
ANTHROPIC_API_KEY=sk-ant-...         # Claude AI 호출용
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### `packages/pipeline/.env`

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
CRAWLER_API_URL=http://localhost:8000  # Python 서비스 주소
GITHUB_TOKEN=ghp_...                   # PR 생성용 (handbook-bot 계정)
GITHUB_REPO_OWNER=cherrypickersGuild
GITHUB_REPO_NAME=cherry-in-the-haystack
NOTION_TOKEN=ntn_...                   # Notion API 인증
```

---

## 7. DB 설정

### 기존 DB에 이미 있어야 하는 것 (cherry-in-the-haystack)

```
content.source                  ← 소스 사이트 마스터
content.source_type_enum        ← 소스 타입 enum
content.article_raw             ← 기사 원문 저장
core.run_log                    ← 실행 이력
core.run_kind_enum              ← 실행 종류 enum
core.prompt_template_version    ← 프롬프트 버전 관리
core.set_updated_at()           ← updated_at 자동 갱신 트리거 함수
```

### 새로 추가해야 하는 것

**순서 중요**: enum 추가 → 새 타입 → 새 테이블 → 기존 테이블 컬럼 추가

#### Step 1. 기존 enum에 값 추가 (별도 트랜잭션으로 먼저 실행)

```sql
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_ANALYSIS';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_GENERATION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_EXECUTION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_FALLBACK';
```

#### Step 2. 새 enum 타입 생성

```sql
DO $$ BEGIN
    CREATE TYPE content.crawler_status_enum AS ENUM (
        'pending_review',   -- 크롤러 생성됨, GitHub PR 리뷰 대기
        'active',           -- PR 머지됨, 매일 실행 중
        'deprecated'        -- 연속 실패 임계값 도달, 비활성화
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

#### Step 3. content.crawler_analysis 테이블

AI가 사이트를 분석한 결과. **소스당 1행**, 재분석 시 덮어씀.

```sql
CREATE TABLE IF NOT EXISTS content.crawler_analysis (
    id                         UUID         NOT NULL,
    source_id                  UUID         NOT NULL,  -- FK → content.source
    analysis_json              JSONB        NOT NULL,  -- CSS 셀렉터, 페이지네이션 등
    prompt_template_version_id UUID         NULL,      -- FK → core.prompt_template_version
    run_log_id                 UUID         NULL,      -- FK → core.run_log
    model_name                 VARCHAR(100) NULL,      -- 사용된 Claude 모델명
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_analysis_source
    ON content.crawler_analysis (source_id);  -- 소스당 1행 강제

CREATE INDEX IF NOT EXISTS idx_crawler_analysis_source
    ON content.crawler_analysis (source_id);

DO $$ BEGIN
    CREATE TRIGGER trg_crawler_analysis_set_updated_at
        BEFORE UPDATE ON content.crawler_analysis
        FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

**analysis_json 내부 필드 계약:**

| 필드 | 타입 | 목적 |
|------|------|------|
| `content_selector` | string | 기사 목록 컨테이너 CSS 셀렉터 |
| `title_selector` | string | 제목 CSS 셀렉터 |
| `date_selector` | string | 날짜 CSS 셀렉터 |
| `author_selector` | string | 작성자 CSS 셀렉터 |
| `url_selector` | string | 링크 CSS 셀렉터 |
| `body_selector` | string | 본문 CSS 셀렉터 |
| `pagination_type` | `none`\|`click`\|`scroll` | 페이지 넘김 방식 |
| `dynamic_load` | boolean | JS 동적 로딩 여부 |
| `notes` | string | AI 분석 메모 |
| `wait_for` | string\|null | crawl4ai 캡처 전 대기 조건 |
| `js_code` | string\|null | 페이지 로드 후 실행할 JS |
| `magic_mode` | boolean | 봇 감지 우회 활성화 여부 |

#### Step 4. content.crawler_registry 테이블

생성된 크롤러 코드와 생명주기. **소스당 여러 행** 가능, active는 1개만.

```sql
CREATE TABLE IF NOT EXISTS content.crawler_registry (
    id                   UUID                        NOT NULL,
    source_id            UUID                        NOT NULL,  -- FK → content.source
    analysis_id          UUID                        NULL,      -- FK → content.crawler_analysis
    status               content.crawler_status_enum NOT NULL DEFAULT 'pending_review',
    generated_code       TEXT                        NOT NULL,  -- Python crawl4ai 스크립트 전문
    pr_number            INT                         NULL,      -- GitHub PR 번호
    pr_url               VARCHAR(1000)               NULL,      -- GitHub PR URL
    pr_merged_at         TIMESTAMPTZ                 NULL,      -- PR 머지 시각
    consecutive_failures INT                         NOT NULL DEFAULT 0,  -- crawl4ai 전용 실패 카운터
    run_log_id           UUID                        NULL,      -- FK → core.run_log
    created_at           TIMESTAMPTZ                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ                 NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- 소스당 active 크롤러는 최대 1개
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_registry_source_active
    ON content.crawler_registry (source_id)
    WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_crawler_registry_source
    ON content.crawler_registry (source_id);

CREATE INDEX IF NOT EXISTS idx_crawler_registry_active
    ON content.crawler_registry (status)
    WHERE (status = 'active');

DO $$ BEGIN
    CREATE TRIGGER trg_crawler_registry_set_updated_at
        BEFORE UPDATE ON content.crawler_registry
        FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

**status 생명주기:**
```
INSERT → pending_review
PR 머지 감지 → active
consecutive_failures ≥ 임계값 → deprecated + 새 pending_review 행 INSERT
```

#### Step 5. content.source 컬럼 추가 (기존 테이블)

```sql
ALTER TABLE content.source
    ADD COLUMN IF NOT EXISTS consecutive_failures INT         NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_success_at      TIMESTAMPTZ NULL;
```

> `crawler_registry.consecutive_failures` vs `source.consecutive_failures` 차이:
> - `registry`: crawl4ai 전용. fallback 성공해도 리셋 안 함. 크롤러 재생성 트리거용
> - `source`: fallback 포함 전체 실패. 어떤 방식으로든 수집 성공하면 리셋

#### Step 6. DB 관련 주의사항

| 항목 | 내용 |
|------|------|
| **PK 생성** | UUID v7 — 앱 레이어에서 생성 후 INSERT. `gen_random_uuid()` 사용 금지 |
| **enum 추가** | `ALTER TYPE ADD VALUE`는 CREATE TABLE과 반드시 별도 트랜잭션으로 실행 |
| **PostgreSQL 버전** | 14+ 권장 (`ALTER TYPE ... IF NOT EXISTS` 지원) |

---

## 8. Python API 엔드포인트

FastAPI 서버 (port 8000). `uvicorn api.main:app --reload --port 8000`으로 실행.

| 엔드포인트 | 타임아웃 | 동작 | AI 사용 |
|-----------|---------|------|---------|
| `POST /crawler/analyze` | 60초 | 브라우저로 사이트 열어 CSS 셀렉터 분석 | browser-use + Claude |
| `POST /crawler/generate` | 30초 | 분석 결과로 Python crawl4ai 코드 생성 | 없음 (순수 템플릿) |
| `POST /crawler/execute` | 30초 | 생성된 코드로 기사 수집 | 없음 |
| `POST /crawler/fallback` | 60초 | AI가 브라우저 직접 조작해 기사 수집 | browser-use + Claude |

---

## 9. sources.yaml 구조

```yaml
sources:
  - url: "https://example.com/blog"
    source_name: "Example Blog"
    source_type: "BLOG"                    # 필수. DB enum과 일치해야 함

  - url: "https://www.linkedin.com/..."
    source_name: "Example LinkedIn"
    source_type: "LINKEDIN"               # LINKEDIN은 browser_use_only 자동 true

  - url: "https://github.com/trending"
    source_name: "GitHub Trending"
    source_type: "GITHUB_TRENDING"
    min_body_length: 30                    # 선택. 기본값 100
    recency_window_days: 1                 # 선택. 기본값 1
    consecutive_failures_threshold: 5      # 선택. 기본값 3
```

**유효한 source_type 값:**
`RSS`, `TWITTER`, `REDDIT`, `LINKEDIN`, `YOUTUBE`, `BLOG`, `COMPANY_BLOG`, `NEWSLETTER`, `GITHUB_TRENDING`, `PRODUCT_HUNT`, `THREADS`, `CUSTOM`

---

## 10. 현재 개발 진행 상태

> 마지막 업데이트: 2026-05-25  
> 모든 스토리가 `review` 상태. 코드 리뷰 후 `done` 처리 필요.

| Epic | 스토리 | 상태 |
|------|--------|------|
| **Epic 1: Source Onboarding Engine** | | |
| | 1.1 DB Migration | review |
| | 1.2 YAML Config Schema & Loader | review |
| | 1.3 Python /crawler/analyze | review |
| | 1.4 Python /crawler/generate | review |
| | 1.5 GitHubCommitter.createPullRequest() | review |
| | 1.6 Source Onboarding Orchestrator | review |
| | 1.7 Python /crawler/execute | review |
| **Epic 2: Scheduled Crawling & Pipeline Integration** | | |
| | 2.1 crawl4ai Crawler Execution Runner | review |
| | 2.2 Article Validation Service | review |
| | 2.3 Dedup & Pipeline Handoff | review |
| **Epic 3: Fallback Collection & Self-Healing** | | |
| | 3.1 browser-use Fallback Collection | review |
| | 3.2 crawl4ai Failure Counter & Regeneration Trigger | review |
| | 3.3 Auto-Regeneration Pipeline | review |
| **Epic 4: Notion Source Registry Sync** | | |
| | 4.1 Notion Source Registry Sync Job | review |

### 다음 작업 우선순위

1. **DB 마이그레이션 실행** — cherry-in-the-haystack 리포에 migration 파일 적용
2. **코드 리뷰 완료** — 각 스토리 review → done 처리
3. **통합 테스트** — Python 서비스 + TypeScript 파이프라인 end-to-end 검증
4. **실제 배포** — 환경변수 설정 및 daily job 스케줄러 등록

---

## 11. 주요 아키텍처 결정 (ADR 요약)

| ADR | 결정 | 이유 |
|-----|------|------|
| ADR-011 | `crawler_analysis`: 소스당 1행, 재분석 시 UPSERT | 분석 빈도 낮음, 단순한 상태 유지 |
| ADR-012 | `crawler_registry`: 소스당 다수 행, status로 구분 | 이력 보존, active는 partial unique index로 강제 |
| ADR-013 | TypeScript ↔ Python: HTTP(port 8000)로 통신 | ADR-006 역할 분리 원칙 유지 |
| ADR-014 | 생성 크롤러: Python `.py` 파일로 PR | human-readable, 리뷰 가능 (NFR-4) |
| ADR-015 | Notion 2개 DB config-driven 매핑 | 향후 DB 추가 시 코드 변경 없이 확장 가능 |

---

## 12. 알아야 할 주의사항

- **크롤러 코드 직접 편집 금지** — `python_services/crawlers/generated/` 파일은 자동 생성됨. 수정이 필요하면 재생성 파이프라인을 통해야 함.
- **sources.yaml 직접 편집 vs Notion** — 두 방법 모두 가능. Notion은 자동으로 PR을 열고, 직접 편집 시 PR을 수동으로 생성해야 함.
- **LinkedIn은 항상 browser-use** — crawl4ai 크롤러가 생성되지 않으며, 매 cycle마다 AI가 직접 수집함. 비용 발생 (~$0.10/run/source).
- **PR 머지 감지는 폴링** — webhook이 아닌 daily job 실행 시마다 GitHub API를 호출. 머지 후 최대 1일 뒤 active 상태로 전환됨.
- **DB UUID는 v7** — 앱 레이어에서 생성. `gen_random_uuid()` (v4) 사용 금지.
- **cherry-in-the-haystack 의존성** — 이 프로젝트는 기존 리포지토리의 DB 스키마(`content.source`, `core.run_log` 등)에 의존함. 반드시 기존 스키마 존재를 확인한 후 마이그레이션 실행.
