# 2안: 핵심기능 신규 개발 (Core Rebuild)

## 개요

기존 auto-news 코드베이스(70+ 파일)에 의존하지 않고, **핵심 기능만 추출하여 처음부터 깔끔하게 재개발**한다. 레거시 코드, 사용하지 않는 모듈, 불필요한 인프라를 모두 걷어내고 실제로 필요한 기능만 남긴다.

---

## 왜 신규 개발인가

### 1안의 한계

| 문제 | 상세 |
|------|------|
| 레거시 의존성 | 70+ 파일 중 실제 사용하는 건 10여 개, 나머지는 import 체인으로 끌려옴 |
| 불필요한 인프라 | Milvus 3컨테이너가 "유사도 스코어링"에만 사용 → SKIP_SCORING으로 우회 중 |
| 코드 복잡도 | notion.py 단일 파일 1600+ 줄, ops_rss.py 550+ 줄 |
| 의존성 과다 | whisper, llama-index, chromadb 등 실제 사용하지 않는 패키지까지 설치 필요 |
| 설정 분산 | .env, src/.env, config/*.py, init.sql 에 설정이 흩어져 있음 |

### 2안의 목표

- **컨테이너 3개**: API + PostgreSQL + Redis
- **파일 15개 이내**: 핵심 로직만 구현
- **의존성 최소화**: 실제 사용하는 패키지만
- **처음부터 한국어 AI 요약 중심 설계**

---

## 핵심 기능 정의

### Must-Have (MVP)

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **RSS 크롤링** | 피드 목록에서 아티클 수집 | P0 |
| **중복 제거** | URL 해시 기반 dedup (Redis) | P0 |
| **AI 요약** | LLM으로 한국어 핵심 요약 생성 | P0 |
| **Notion 적재** | 요약 결과를 Notion DB에 push | P0 |
| **PostgreSQL 저장** | 아티클 + 요약 이중 저장 | P0 |
| **REST API** | 아티클 조회, 검색, 피드 관리 | P0 |
| **배치 스케줄** | 주기적 자동 크롤링 | P0 |

### Nice-to-Have (Phase 2)

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| HackerNews 크롤링 | Firebase API 기반 | P1 |
| Dev.to 크롤링 | REST API 기반 | P1 |
| Substack 크롤링 | RSS + 웹 스크래핑 | P1 |
| 벡터 임베딩 스코어링 | 유사도 기반 관련성 필터 | P2 |
| 카테고리 분류 | LLM 기반 자동 분류 | P1 |
| 주간 컬렉션 | 주간 하이라이트 생성 | P2 |

### 제거 대상 (사용하지 않음)

| 기능 | 이유 |
|------|------|
| Milvus 벡터 DB | SKIP_SCORING으로 우회 중, PostgreSQL pg_trgm으로 대체 가능 |
| Whisper 음성 변환 | YouTube 트랜스크립트에만 사용, 현재 비활성 |
| Autogen 멀티에이전트 | 실험적 기능, 현재 비활성 |
| ChromaDB | Milvus와 중복, 현재 미사용 |
| LlamaIndex | 현재 미사용 |
| MySQL 클라이언트 | PostgreSQL로 대체 완료 |
| Airflow DAGs | APScheduler로 대체 완료 |

---

## 아키텍처

```
┌─────────────────┐     ┌──────────────────────────┐     ┌────────────────┐
│  Data Sources    │     │  cherry-news (1 컨테이너)  │     │  Output        │
│                  │     │                          │     │                │
│ RSS Feeds        │────▶│ FastAPI    (API 서버)      │────▶│ Notion DB      │
│ (HN, Dev.to)    │     │ APScheduler (스케줄러)     │     │ PostgreSQL     │
│                  │     │ Crawler    (수집기)       │     └────────────────┘
└─────────────────┘     │ Summarizer (AI 요약)      │
                        └────────┬─────────────────┘
                       ┌─────────▼──────────┐
                       │  Infra (2 컨테이너)  │
                       │ PostgreSQL 16       │
                       │ Redis 7             │
                       └────────────────────┘
```

**컨테이너: 3개 (1안의 절반)**

---

## 프로젝트 구조

```
cherry-news/
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yaml
│   └── init.sql
│
├── src/
│   ├── main.py              # FastAPI 앱 + 스케줄러
│   ├── config.py             # 환경 변수 + 설정 통합 관리
│   ├── models.py             # Pydantic 스키마
│   ├── db.py                 # PostgreSQL 클라이언트
│   │
│   ├── crawler/
│   │   ├── __init__.py
│   │   ├── rss.py            # RSS 피드 크롤러
│   │   ├── hackernews.py     # HackerNews API (Phase 2)
│   │   └── devto.py          # Dev.to API (Phase 2)
│   │
│   ├── processor/
│   │   ├── __init__.py
│   │   ├── dedup.py          # Redis 기반 중복 제거
│   │   └── summarizer.py     # LLM 요약 (한국어 중심)
│   │
│   ├── publisher/
│   │   ├── __init__.py
│   │   └── notion.py         # Notion API 클라이언트 (경량화)
│   │
│   └── api/
│       ├── __init__.py
│       ├── articles.py       # 아티클 CRUD + 검색
│       ├── feeds.py          # 피드 관리
│       └── jobs.py           # 잡 실행 + 트리거
│
├── .env
├── requirements.txt
└── README.md
```

**총 파일 수: ~15개** (1안의 70+ 대비 80% 감소)

---

## 기술 스택

| 카테고리 | 기술 | 버전 | 비고 |
|---------|------|------|------|
| **웹 프레임워크** | FastAPI | 0.115+ | |
| **ASGI 서버** | Uvicorn | 0.30+ | |
| **스케줄러** | APScheduler | 3.10+ | |
| **데이터베이스** | PostgreSQL | 16 | FTS (tsvector + pg_trgm) |
| **캐시** | Redis | 7 | dedup + 요약 캐시 |
| **LLM** | LiteLLM | 1.80+ | 멀티 프로바이더 통합 |
| **RSS 파서** | feedparser | latest | |
| **HTTP 클라이언트** | httpx | latest | 비동기 지원 |
| **Notion API** | notion-client | latest | |
| **HTML 파서** | BeautifulSoup4 | latest | 본문 추출 |

### 의존성 비교

| | 1안 | 2안 |
|---|---|---|
| requirements.txt | 44개 패키지 | ~12개 패키지 |
| 이미지 크기 (예상) | ~2 GB | ~500 MB |
| 설치 시간 | ~5분 | ~1분 |

---

## DB 스키마

```sql
-- articles: 핵심 테이블
CREATE TABLE articles (
    id              SERIAL PRIMARY KEY,
    hash            VARCHAR(64) NOT NULL UNIQUE,
    source          VARCHAR(50) NOT NULL,       -- rss, hackernews, devto
    feed_name       VARCHAR(256) NOT NULL,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    content         TEXT,
    summary_ko      TEXT,                       -- 한국어 AI 요약
    why_it_matters  TEXT,                       -- 왜 중요한가
    insights        TEXT[],                     -- 핵심 통찰 배열
    tags            TEXT[],
    category        VARCHAR(50),
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    notion_page_id  VARCHAR(64),
    search_vector   TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary_ko, '')), 'B')
    ) STORED
);

-- feeds: 피드 설정
CREATE TABLE feeds (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(256) NOT NULL UNIQUE,
    url         TEXT NOT NULL,
    type        VARCHAR(20) DEFAULT 'rss',  -- rss, hackernews, devto
    category    VARCHAR(50),
    enabled     BOOLEAN DEFAULT TRUE,
    max_items   INTEGER DEFAULT 5,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- jobs: 실행 이력
CREATE TABLE jobs (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    status      VARCHAR(20) DEFAULT 'running',
    stats       JSONB,
    error       TEXT,
    started_at  TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
```

**1안 대비 변경점:**
- `articles.summary` → `articles.summary_ko` (한국어 명시)
- `articles.insights` → `TEXT[]` (PostgreSQL 네이티브 배열, JSONB 대신)
- `articles.examples`, `articles.categories` 제거 (과도한 필드)
- `index_pages`, `patches` 테이블 제거 (레거시)

---

## AI 요약 설계 (한국어 중심)

### 프롬프트 구조

```python
SUMMARY_PROMPT = """
다음 기술 아티클을 분석하고 한국어로 요약해 주세요.

## 출력 형식 (JSON)
{
  "summary": "핵심 내용 3-5문장 요약",
  "why_it_matters": "이 내용이 중요한 이유 1-2문장",
  "insights": ["핵심 통찰 1", "핵심 통찰 2", "핵심 통찰 3"],
  "category": "카테고리명"
}

## 카테고리 옵션
- AI 모델/도구 출시
- 기술 딥다이브
- 산업 트렌드
- 오픈소스 프로젝트
- 연구 논문
- 개발자 실무

## 규칙
- 반드시 한국어로 작성
- 기술 용어는 영어 병기 가능 (예: 파인튜닝(Fine-tuning))
- 숫자와 통계는 정확히 유지
- 추측이나 의견 금지, 원문 기반 사실만

본문:
{content}
"""
```

### LLM 프로바이더 통합 (LiteLLM)

```python
# config.py
class Settings:
    LLM_PROVIDER: str = "google"           # google, openai, ollama
    LLM_MODEL: str = "gemini/gemini-2.0-flash"
    LLM_API_KEY: str = ""
    LLM_FALLBACK_MODEL: str = "ollama/llama3"  # 폴백

# processor/summarizer.py
import litellm

def summarize(content: str) -> dict:
    response = litellm.completion(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": content}
        ],
        response_format={"type": "json_object"},
        api_key=settings.LLM_API_KEY,
    )
    return json.loads(response.choices[0].message.content)
```

**1안 대비 개선점:**
- LangChain 제거 → LiteLLM 직접 호출 (경량)
- `response_format=json_object`로 구조화된 출력 보장
- 폴백 모델 자동 전환

---

## Notion 적재 (경량화)

```python
# publisher/notion.py
class NotionPublisher:
    def push_article(self, article: dict) -> str:
        """아티클을 Notion DB에 push. page_id 반환."""
        properties = {
            "Name": {"title": [{"text": {"content": article["title"]}}]},
            "URL": {"url": article["url"]},
            "AI summary": {"rich_text": [{"text": {"content": article["summary_ko"]}}]},
            "Why it matters": {"rich_text": [{"text": {"content": article["why_it_matters"]}}]},
            "Insights": {"rich_text": [{"text": {"content": "\n".join(f"• {i}" for i in article["insights"])}}]},
            "Source": {"select": {"name": article["source"]}},
            "Category": {"select": {"name": article["category"]}},
            "Published at": {"date": {"start": article["published_at"]}},
        }

        blocks = [
            self._heading(article["title"]),
            self._paragraph(article["summary_ko"]),
            self._divider(),
            self._heading("왜 중요한가", level=3),
            self._paragraph(article["why_it_matters"]),
            self._heading("핵심 통찰", level=3),
            *[self._bullet(insight) for insight in article["insights"]],
            self._divider(),
            self._link(article["url"]),
        ]

        page = self.client.pages.create(
            parent={"database_id": self.database_id},
            properties=properties,
            children=blocks,
        )
        return page["id"]
```

**1안 대비 개선점:**
- notion.py 1600줄 → ~100줄
- 명확한 Notion 블록 구조 (요약 → 왜 중요한가 → 통찰 → 원문 링크)
- 한국어 AI 요약이 "AI summary" 필드에 직접 적재

---

## 파이프라인 흐름

```
1. Crawl    : RSS 피드에서 아티클 수집
                 ↓
2. Dedup    : Redis에서 URL 해시 확인 → 중복 스킵
                 ↓
3. Extract  : 본문 추출 (웹 페이지 로드 or RSS summary 사용)
                 ↓
4. Summarize: LLM으로 한국어 요약 생성 (캐시 저장)
                 ↓
5. Publish  : Notion DB에 push (properties + blocks)
                 ↓
6. Save     : PostgreSQL에 저장 (FTS 인덱스 자동 갱신)
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 체크 |
| GET | `/articles` | 목록 (source, category, date 필터) |
| GET | `/articles/search?q=` | FTS 검색 |
| GET | `/articles/{id}` | 상세 |
| GET | `/feeds` | 피드 목록 |
| POST | `/feeds` | 피드 추가 |
| PATCH | `/feeds/{id}` | 피드 수정 |
| DELETE | `/feeds/{id}` | 피드 삭제 |
| POST | `/jobs/crawl` | 수동 크롤링 실행 |
| GET | `/jobs/latest` | 최근 실행 결과 |

---

## 개발 일정 (예상)

### Phase 1: MVP (핵심 파이프라인)

| 작업 | 내용 |
|------|------|
| 프로젝트 세팅 | Docker, PostgreSQL 스키마, FastAPI 뼈대 |
| RSS 크롤러 | feedparser 기반 수집 + httpx 본문 추출 |
| Dedup | Redis 해시 기반 중복 제거 |
| AI 요약 | LiteLLM + 한국어 프롬프트 |
| Notion 적재 | 경량 Notion 클라이언트 |
| PostgreSQL 저장 | 아티클 저장 + FTS |
| 스케줄러 | APScheduler cron |
| API | 아티클 조회 + 검색 + 피드 CRUD |

### Phase 2: 소스 확장

| 작업 | 내용 |
|------|------|
| HackerNews | Firebase API 크롤러 |
| Dev.to | REST API 크롤러 |
| 카테고리 분류 | LLM 기반 자동 분류 |

### Phase 3: 고도화

| 작업 | 내용 |
|------|------|
| 요약 품질 개선 | 피드별 프롬프트 커스텀 |
| 주간 다이제스트 | 주간 하이라이트 자동 생성 |
| 알림 | 슬랙/텔레그램 연동 |

---

## 1안 vs 2안 비교

| 항목 | 1안 (리팩토링) | 2안 (신규 개발) |
|------|--------------|---------------|
| **컨테이너** | 6개 | 3개 |
| **소스 파일** | 70+ (레거시 포함) | ~15개 |
| **의존성** | 44개 패키지 | ~12개 패키지 |
| **Docker 이미지** | ~2 GB | ~500 MB |
| **Milvus** | 유지 (3컨테이너) | 제거 |
| **LLM 연동** | LangChain | LiteLLM (경량) |
| **Notion 코드** | 1600줄 | ~100줄 |
| **기존 기능 호환** | 100% | 핵심 기능만 |
| **AI 요약** | 기존 프롬프트 유지 | 한국어 중심 재설계 |
| **개발 비용** | 완료 | 신규 개발 필요 |
| **유지보수** | 레거시 이해 필요 | 깔끔한 코드베이스 |
| **확장성** | 기존 구조에 제약 | 자유로운 설계 |

---

## 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 기존 기능 누락 | 1안에 있던 기능 빠질 수 있음 | MVP 기능 목록 명확히 정의 |
| LLM API 비용 | 요약 생성 시 API 호출 비용 | Ollama 로컬 폴백 + Redis 캐시 |
| Notion API 제약 | Rate limit, 블록 크기 제한 | 배치 처리 + 청크 분할 |
| 개발 기간 | 처음부터 개발 | 1안 코드 참고하여 빠르게 구현 |

---

## 결론

- **1안**은 기존 시스템을 최소 변경으로 경량화한 "안전한" 접근
- **2안**은 실제 사용하는 핵심 기능만 깔끔하게 재구현하는 "근본적" 접근
- 2안은 컨테이너 3개, 파일 15개, 의존성 12개로 **운영 복잡도를 최소화**
- 1안의 검증된 로직(크롤링, 요약, Notion 적재)을 참고하면서 깔끔하게 재작성
