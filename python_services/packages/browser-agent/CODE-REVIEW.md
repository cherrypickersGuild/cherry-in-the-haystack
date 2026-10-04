### 문서 설명: 코드 흐름을 적어놓은 것 (claude 답변)



● 이제 전체 구조를 파악했습니다. 정리해서 설명드리겠습니다.

  ---
  프로젝트 개요

  이 프로젝트는 웹 크롤러 자동화 파이프라인입니다. 뉴스/블로그 소스를 자동으로 분석하고, 크롤러를 생성·실행하여 기사 데이터를 수집합니다.

  두 개의 서비스로 구성됩니다:
  - packages/pipeline — TypeScript (Node.js) 오케스트레이터
  - python_services — Python FastAPI 크롤러 실행 서버

  ---
  코드 실행 흐름

  [TypeScript Pipeline] runBrowserCrawlJob()
          │
          ├── Phase 1: 소스 온보딩
          │      │
          │      ├─ processSource() — sources.yaml에서 소스 목록 로드
          │      │      │
          │      │      ├─ POST /crawler/analyze   ← Python FastAPI
          │      │      │       └─ browser-use Agent로 페이지 DOM 분석
          │      │      │          → CSS 셀렉터 등 분석 결과 반환
          │      │      │
          │      │      ├─ POST /crawler/generate  ← Python FastAPI
          │      │      │       └─ 분석 결과로 crawl4ai Python 스크립트 생성
          │      │      │
          │      │      └─ GitHub PR 생성 (생성된 크롤러 코드 포함)
          │      │             └─ PR 머지 감지 → 크롤러 활성화
          │      │
          └── Phase 2: 크롤러 실행
                 │
                 ├─ POST /crawler/execute  ← Python FastAPI
                 │       └─ crawl4ai로 실제 크롤링 → 기사 파싱
                 │
                 └─ (실패 시) POST /crawler/fallback
                         └─ browser-use Agent로 직접 페이지 읽기

  DB 역할

  - crawler_analysis — 페이지 분석 결과 캐시
  - crawler_registry — 생성된 크롤러 등록 (pending/active/deprecated)
  - article_raw — 수집된 기사 저장 (중복 SHA256 해시로 방지)
  - run_log — 각 실행 이력

  ---
  실행 방법

  1. Python 서버 (FastAPI)

  # 의존성 설치
  pip install -r python_services/requirements.txt

  # 서버 실행
  DATABASE_URL=postgresql://user:pass@localhost/dbname \
  ANTHROPIC_API_KEY=sk-... \
  uvicorn api.main:app --reload --port 8000

  서버 실행 후 API 문서: http://localhost:8000/docs

  2. TypeScript Pipeline (Node.js)

  cd packages/pipeline

  # 의존성 설치
  npm install

  # 빌드
  npm run build

  # 테스트 실행
  npm test

  Pipeline 실행 시 필요한 환경 변수:
  DATABASE_URL=postgresql://...
  CRAWLER_API_URL=http://localhost:8000   # Python 서버 주소
  GITHUB_TOKEN=ghp_...
  GITHUB_REPO_OWNER=...
  GITHUB_REPO_NAME=...

  3. DB 마이그레이션

  npm install

  # 빌드
  npm run build

  # 테스트 실행
  npm test

  Pipeline 실행 시 필요한 환경 변수:
  DATABASE_URL=postgresql://...
  CRAWLER_API_URL=http://localhost:8000   # Python 서버 주소
  GITHUB_TOKEN=ghp_...
  GITHUB_REPO_OWNER=...
  GITHUB_REPO_NAME=...

  3. DB 마이그레이션

  # db/migrations/ 아래 SQL 파일들을 순서대로 실행
  # 20260523000001_add_crawler_tables.sql
  # 20260525000001_add_crawler_fallback_enum.sql

  ---
  핵심 파일 위치:

  ┌──────────────────────┬────────────────────────────────────────────────┐
  │         역할         │                      파일                      │
  ├──────────────────────┼────────────────────────────────────────────────┤
  │ Python 진입점        │ python_services/api/main.py                    │
  ├──────────────────────┼────────────────────────────────────────────────┤
  │ API 라우터           │ python_services/api/routers/crawler.py         │
  ├──────────────────────┼────────────────────────────────────────────────┤
  │ TS 파이프라인 진입점 │ packages/pipeline/src/jobs/browser-crawl.ts:91 │
  ├──────────────────────┼────────────────────────────────────────────────┤
  │ 소스 설정            │ packages/pipeline/config/sources.yaml          │
  ├──────────────────────┼────────────────────────────────────────────────┤
  │ DB 쿼리              │ packages/pipeline/src/db/crawler-db.ts         │
  └──────────────────────┴────────────────────────────────────────────────┘


  ● 두 .env 파일에 있는 환경변수를 설명합니다.

  ---
  python_services/.env

  ┌───────────────────┬────────────────────────────────────────────────────────────────┐
  │       변수        │                              설명                              │
  ├───────────────────┼────────────────────────────────────────────────────────────────┤
  │ DATABASE_URL      │ PostgreSQL DB 연결 문자열. Python 서비스가 DB에 접근할 때 사용 │
  ├───────────────────┼────────────────────────────────────────────────────────────────┤
  │ ANTHROPIC_API_KEY │ Claude AI API 인증 키. AI 기능 호출 시 필요                    │
  ├───────────────────┼────────────────────────────────────────────────────────────────┤
  │ ANTHROPIC_MODEL   │ 사용할 Claude 모델 버전 지정 (현재 claude-3-5-sonnet)          │
  └───────────────────┴────────────────────────────────────────────────────────────────┘

  ---
  packages/pipeline/.env

  ┌───────────────────┬───────────────────────────────────────────────────────────────────┐
  │       변수        │                               설명                                │
  ├───────────────────┼───────────────────────────────────────────────────────────────────┤
  │ DATABASE_URL      │ PostgreSQL DB 연결 문자열 (위와 동일 구조)                        │
  ├───────────────────┼───────────────────────────────────────────────────────────────────┤
  │ CRAWLER_API_URL   │ Python 크롤러 서버 주소. 파이프라인이 크롤링 API를 호출할 때 사용 │
  ├───────────────────┼───────────────────────────────────────────────────────────────────┤
  │ GITHUB_TOKEN      │ GitHub API 인증 토큰. 리포지토리 접근 권한                        │
  ├───────────────────┼───────────────────────────────────────────────────────────────────┤
  │ GITHUB_REPO_OWNER │ 대상 GitHub 리포지토리 소유자 (cherrypickersGuild)                │
  ├───────────────────┼───────────────────────────────────────────────────────────────────┤
  │ GITHUB_REPO_NAME  │ 대상 GitHub 리포지토리 이름 (cherry-in-the-haystack)              │
  ├───────────────────┼───────────────────────────────────────────────────────────────────┤
  │ NOTION_TOKEN      │ Notion API 인증 토큰. Notion 데이터 읽기/쓰기에 사용              │
  └───────────────────┴───────────────────────────────────────────────────────────────────┘

  ---
  전체적인 구조: Python 크롤러 서비스가 GitHub/Notion에서 데이터를 수집하고, AI(Claude)로 처리한 뒤 PostgreSQL DB에 저장하는 파이프라인으로 보입니다.

  ---
  전체 흐름

  Notion (사람이 URL 등록)
      ↓ 매일 자동 동기화
  sources.yaml → GitHub PR
      ↓ PR 머지
  browser-crawl job
      ↓ Claude AI가 사이트 분석 & 크롤러 코드 생성
  PostgreSQL (분석 결과, 크롤러 코드, 상태 추적)

  한 줄 요약: Notion은 "어떤 사이트를 크롤링할까" 결정하는 곳, DB는 "그 크롤링을 어떻게 실행하고 있나" 추적하는 곳입니다.

❯ Notion에서 어떻게 sources.yaml로 변환되는지 보여줘                                                                                                                                                    

● 관련 파일들을 직접 읽어볼게요.
  
  Searched for 1 pattern, read 3 files (ctrl+o to expand)

● 코드를 직접 읽었으니 단계별로 보여드릴게요.

  ---
  Notion → sources.yaml 변환 흐름

  1단계: Notion에서 페이지 조회

  // 2개 DB를 순서대로 쿼리 (페이지네이션 지원)
  notion.databases.query({ database_id: dbConfig.databaseId })

  각 페이지에서 3가지 추출기로 필드를 꺼냄:

  // Notion 속성 타입(url/rich_text/title/select/checkbox)에 따라 분기
  const url          = extractUrlFromProperty(page, 'Linkedin' or 'URL')
  const name         = extractTextFromProperty(page, 'Name')
  const sourceType   = extractTextFromProperty(page, 'source_type')
  const browserUseOnly = extractCheckboxFromProperty(page, 'browser_use_only')

  ---
  2단계: 유효성 검사 & 중복 제거

  // 필수 필드 누락 → skip
  if (!url || !name || !sourceType) continue

  // 유효하지 않은 source_type → skip
  if (!CONTENT_SOURCE_TYPES.includes(sourceType)) continue

  // 이미 YAML에 있는 URL → skip (기존 + 동일 실행 내 중복 모두)
  if (existingUrls.has(url)) continue

  ---
  3단계: YAML 엔트리 생성

  const entry = { url, source_name: name, source_type: sourceType }
  if (browserUseOnly !== null) entry.browser_use_only = browserUseOnly

  Notion 행 하나가 아래처럼 변환됨:

  - url: "https://example.com/blog"
    source_name: "Example Blog"
    source_type: "BLOG"
    browser_use_only: false   # Notion 체크박스가 있을 때만 포함

  ---
  4단계: 기존 YAML에 병합 후 GitHub PR 생성

  // 기존 sources.yaml 읽고 상단 주석 헤더 보존 + 새 항목 append
  const updatedYaml = buildUpdatedYaml(CONFIG_PATH, newEntries)

  // PR 자동 생성
  committer.createPullRequest({
    branch: `feat/notion-sync/2026-05-30`,
    title: `feat(notion-sync): add 3 new source(s) from Notion`,
    files: [{ path: 'packages/pipeline/config/sources.yaml', content: updatedYaml }]
  })

  PR이 머지되면 다음 daily cycle에 browser-crawl job이 새 소스를 감지해 크롤러 자동 생성을 시작합니다.

❯ PR 머지되면 browser-crawl job이 정확히 어떻게 새 소스 감지하는지 보여줘                                                                                                                               

  Read 1 file (ctrl+o to expand)

● 코드를 직접 읽었습니다. processSource() 함수의 판단 로직을 중심으로 설명할게요.

  ---
  PR 머지 후 새 소스 감지 흐름

  핵심: processSource() 의 상태 기반 분기 (browser-crawl.ts:121)

  매일 job이 실행될 때 sources.yaml의 모든 소스를 순회하며 DB 상태를 보고 판단합니다.

  sources.yaml 로드
      ↓
  각 source에 대해 processSource() 실행
      ↓
      ┌─ browser_use_only? → 건너뜀 (crawl4ai 불필요)
      │
      ├─ DB에서 해당 source의 registry 조회
      │
      ├─ status = 'active'     → 이미 운영 중, 아무것도 안 함
      │
      ├─ status = 'pending_review'
      │   ├─ pr_number 있음    → GitHub에 PR 머지 여부 확인 ← 여기가 핵심
      │   └─ pr_number 없음    → PR 생성 재시도
      │
      └─ registry 없음
          ├─ deprecated 이력 있음 → 재생성 파이프라인
          └─ 완전 신규           → 풀 온보딩 파이프라인

  ---
  PR 머지 감지 로직 (checkAndActivatePR, line 259)

  // GitHub API로 PR 상태 직접 조회
  const pr = await octokit.rest.pulls.get({
    owner, repo,
    pull_number: registry.prNumber,  // DB에 저장된 PR 번호 사용
  })

  if (pr.data.merged_at) {
    // merged_at이 있으면 → DB에서 status = 'active'로 업데이트
    await activateRegistry(pool, registry.id, new Date(pr.data.merged_at))
  }

  "감지"가 아니라 "매일 폴링" 방식입니다. webhook이 아니라 daily job 실행 시마다 GitHub API를 찔러봄.

  ---
  신규 소스의 전체 온보딩 흐름 (runFullPipeline, line 187)

  sources.yaml에 새 URL 등장
      ↓
  DB에 source 행 없음 → INSERT (content.source)
  registry도 없음 → 신규 소스 판단
      ↓
  POST /crawler/analyze  (Python API, 65초 타임아웃)
      → CSS 셀렉터, 페이지네이션 방식 등 분석
      → crawler_analysis 행 생성
      ↓
  POST /crawler/generate (Python API, 35초 타임아웃)
      → Python crawl4ai 코드 생성
      → crawler_registry 행 생성 (status: pending_review)
      ↓
  GitHub PR 생성
      → python_services/crawlers/generated/{kebab-name}.py
      → crawler_registry에 pr_number, pr_url 저장
      ↓
  [다음 daily cycle]
      PR merged_at 확인 → status: 'active'
      ↓
  [그 다음 daily cycle부터]
      Phase 2: active crawler 실행 (POST /crawler/execute)

  ---
  요약

  ┌────────────────────────────────┬────────────────────────────────────────────┐
  │              상황              │                    동작                    │
  ├────────────────────────────────┼────────────────────────────────────────────┤
  │ sources.yaml에 처음 등장한 URL │ DB INSERT → analyze → generate → GitHub PR │
  ├────────────────────────────────┼────────────────────────────────────────────┤
  │ PR 생성됐고 아직 미머지        │ GitHub API로 merged_at 확인, 없으면 대기   │
  ├────────────────────────────────┼────────────────────────────────────────────┤
  │ PR 머지됨                      │ merged_at 감지 → DB status active로 전환   │
  ├────────────────────────────────┼────────────────────────────────────────────┤
  │ active 상태                    │ 매일 /crawler/execute 실행해서 기사 수집   │
  └────────────────────────────────┴────────────────────────────────────────────┘

# 정리
  프로젝트 인수인계 가이드

  1. 프로젝트 한 줄 요약

  ▎ Notion에 URL을 등록하면, AI가 자동으로 해당 사이트의 크롤러를 생성하고, 매일 기사를 수집해 DB에 저장하는 파이프라인

  ---
  2. 시스템 구성요소

  ┌──────────────┐   ┌─────────────────────────┐   ┌──────────────────┐
  │    Notion    │   │  Node.js Pipeline        │   │  Python Service  │
  │  (소스 등록) │   │  packages/pipeline/      │   │  python_services/│
  │              │   │  - notion-sync job       │   │  - FastAPI       │
  │  LinkedIn DB │   │  - browser-crawl job     │   │  - /analyze      │
  │  Custom DB   │   │  - github-committer      │   │  - /generate     │
  └──────────────┘   │  - crawler-db            │   │  - /execute      │
                     └─────────────────────────┘   │  - /fallback     │
                                │                   └──────────────────┘
                     ┌──────────┴──────────┐
                     │     GitHub Repo     │
                     │  - sources.yaml     │
                     │  - generated/*.py   │
                     └──────────┬──────────┘
                                │
                     ┌──────────┴──────────┐
                     │    PostgreSQL DB     │
                     │  - content.source   │
                     │  - crawler_analysis │
                     │  - crawler_registry │
                     │  - article_raw      │
                     └─────────────────────┘

  ---
  3. 전체 데이터 흐름

  Phase 1 — 소스 등록 (Notion → sources.yaml)

  트리거: 매일 1회 notion-sync job 실행

  ① 사람이 Notion의 두 DB 중 하나에 URL 입력
     - LinkedIn DB: LinkedIn 회사 페이지
     - Custom Crawl DB: 일반 블로그/뉴스

  ② notion-sync job이 두 DB를 전부 쿼리
     - URL, Name, source_type, browser_use_only 추출
     - 필수 필드 없거나 source_type 유효하지 않으면 skip
     - 이미 sources.yaml에 있는 URL은 skip (중복 제거)

  ③ 신규 소스를 sources.yaml에 append 후 GitHub PR 생성
     브랜치: feat/notion-sync/2026-05-30

  ---
  Phase 2 — 크롤러 자동 생성 (sources.yaml → crawler 코드)

  트리거: 매일 1회 browser-crawl job 실행 (Phase 1 이후)

  ④ sources.yaml 로드 → 각 소스에 대해 DB 상태 확인

  ⑤ 신규 소스 (DB에 registry 없음) → 온보딩 파이프라인:

     POST /crawler/analyze
     └─ browser-use Agent가 실제로 브라우저를 열어 페이지 분석
     └─ Claude AI가 CSS 셀렉터, 페이지네이션, 동적 로딩 여부 파악
     └─ 결과를 crawler_analysis 테이블에 저장 (소스당 1행, 재분석 시 덮어씀)

     POST /crawler/generate
     └─ 분석 결과를 바탕으로 crawl4ai Python 스크립트 생성 (LLM 없이 순수 템플릿)
     └─ crawler_registry 테이블에 저장 (status: pending_review)

     GitHub PR 생성
     └─ python_services/crawlers/generated/{kebab-name}.py 파일로 PR
     └─ crawler_registry에 pr_number, pr_url 저장

  ⑥ pending_review 소스 → PR 머지 여부 폴링:
     GitHub API로 merged_at 확인
     └─ 머지됨 → crawler_registry.status = 'active'
     └─ 미머지 → 대기 (다음 cycle에 재확인)

  ---
  Phase 3 — 매일 기사 수집 (active crawler 실행)

  트리거: Phase 2와 같은 daily job 실행, 그 이후 단계

  ⑦ crawler_registry에서 status='active' 인 크롤러 전체 조회

  ⑧ browser_use_only=false 소스:
     POST /crawler/execute
     └─ DB에서 generated_code 로드 → exec()으로 동적 실행
     └─ crawl4ai가 CSS 셀렉터로 기사 목록 추출
     └─ 유효성 검사: 제목 없음, 본문 너무 짧음, 날짜 오래됨, URL 깨짐 → 개별 skip
     └─ SHA-256 해시로 중복 기사 제거
     └─ article_raw 테이블에 INSERT

  ⑨ browser_use_only=true 소스 (LINKEDIN 포함):
     POST /crawler/fallback
     └─ browser-use Agent가 브라우저를 직접 조작해 기사 추출 (AI가 시각적으로 읽음)
     └─ 동일하게 유효성 검사 → 중복 제거 → article_raw INSERT

  ⑩ 실행 실패 시:
     crawler_registry.consecutive_failures 카운터 증가
     └─ 임계값(기본 3회) 도달 → status = 'deprecated'
     └─ 다음 cycle에 재생성 파이프라인 자동 트리거
     └─ 재생성 대기 중에도 fallback으로 기사 계속 수집

  ---
  4. DB 테이블 역할

  ┌──────────────────────────┬──────────────────────────────────────────────────────────────────┐
  │          테이블          │                               역할                               │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ content.source           │ 소스 사이트 마스터. URL, 이름, 타입                              │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ content.crawler_analysis │ AI 분석 결과. CSS 셀렉터 등. 소스당 1행                          │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ content.crawler_registry │ 생성된 크롤러 코드와 상태 (pending_review → active → deprecated) │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ content.article_raw      │ 수집된 기사 원문. 중복은 SHA-256 해시로 제거                     │
  ├──────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ core.run_log             │ 모든 AI 작업 실행 이력 (COMPLETED/FAILED)                        │
  └──────────────────────────┴──────────────────────────────────────────────────────────────────┘

  ---
  5. browser_use_only 플래그 이해

  sources.yaml의 browser_use_only 필드가 핵심 분기점:

  browser_use_only = true
  ├─ LINKEDIN은 자동으로 true
  ├─ crawl4ai 크롤러 생성 안 함 (analyze/generate skip)
  └─ 매 cycle마다 browser-use AI가 직접 브라우저 조작해서 수집

  browser_use_only = false (기본)
  ├─ 최초 1회: analyze → generate → PR
  ├─ PR 머지 후: crawl4ai 정적 크롤러로 매일 실행
  └─ 실패 누적 시: deprecated → 재생성 → 머지 전까지 fallback 병행

  ---
  6. Python API 엔드포인트 정리

  ┌────────────────────────┬─────────────────────────────────────┬──────────────────────┬──────────┐
  │       엔드포인트       │               하는 일               │       AI 사용        │ 타임아웃 │
  ├────────────────────────┼─────────────────────────────────────┼──────────────────────┼──────────┤
  │ POST /crawler/analyze  │ 브라우저로 페이지 열어 구조 분석    │ browser-use + Claude │ 60초     │
  ├────────────────────────┼─────────────────────────────────────┼──────────────────────┼──────────┤
  │ POST /crawler/generate │ 분석 결과로 Python 코드 생성        │ 없음 (순수 템플릿)   │ 30초     │
  ├────────────────────────┼─────────────────────────────────────┼──────────────────────┼──────────┤
  │ POST /crawler/execute  │ 생성된 crawl4ai 코드로 기사 수집    │ 없음                 │ 30초     │
  ├────────────────────────┼─────────────────────────────────────┼──────────────────────┼──────────┤
  │ POST /crawler/fallback │ AI가 브라우저 직접 조작해 기사 수집 │ browser-use + Claude │ 60초     │
  └────────────────────────┴─────────────────────────────────────┴──────────────────────┴──────────┘

  ---
  7. 주요 파일 위치

  browser/
  ├── packages/pipeline/
  │   ├── src/
  │   │   ├── jobs/
  │   │   │   ├── notion-sync.ts       # Notion → sources.yaml → GitHub PR
  │   │   │   └── browser-crawl.ts     # 온보딩 + 실행 + 실패 처리
  │   │   ├── config/
  │   │   │   └── source-config.ts     # YAML 스키마 정의 및 검증
  │   │   ├── db/
  │   │   │   └── crawler-db.ts        # 모든 DB 쿼리
  │   │   └── publication/
  │   │       └── github-committer.ts  # GitHub PR 자동화
  │   └── config/
  │       └── sources.yaml             # 크롤링 소스 목록 (사람+자동 관리)
  │
  ├── python_services/
  │   └── api/
  │       ├── main.py                  # FastAPI 앱 (port 8000)
  │       ├── routers/crawler.py       # 4개 엔드포인트 구현
  │       ├── models/crawler.py        # Pydantic 요청/응답 모델
  │       └── prompts/
  │           ├── crawler_analysis.py  # AI 분석 프롬프트
  │           └── crawler_fallback.py  # AI 폴백 프롬프트
  │
  └── db/migrations/                   # PostgreSQL 마이그레이션 SQL

  ---
  8. 환경변수 설정

  python_services/.env
  DATABASE_URL=postgresql://...
  ANTHROPIC_API_KEY=sk-ant-...    # Claude AI 호출용
  ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

  packages/pipeline/.env
  DATABASE_URL=postgresql://...
  CRAWLER_API_URL=http://localhost:8000  # Python 서비스 주소
  GITHUB_TOKEN=ghp_...                   # PR 생성용
  GITHUB_REPO_OWNER=cherrypickersGuild
  GITHUB_REPO_NAME=cherry-in-the-haystack
  NOTION_TOKEN=ntn_...                   # Notion API 인증
