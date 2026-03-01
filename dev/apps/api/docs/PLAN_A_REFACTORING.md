# 1안: Auto-News 리팩토링 (현재 완료)

## 개요

기존 Apache Airflow 기반 14+ 컨테이너 아키텍처를 **FastAPI + APScheduler 기반 6컨테이너**로 경량화하고, REST API를 추가하여 데이터 접근성을 확보한 리팩토링.

---

## Before vs After

| 항목 | Before | After |
|------|--------|-------|
| **컨테이너 수** | 14+ | 6 (57% 감소) |
| **오케스트레이터** | Apache Airflow 2.5 | APScheduler (인프로세스) |
| **태스크 큐** | Celery + Redis | 없음 (ThreadPool) |
| **데이터베이스** | MySQL 8.4 + PostgreSQL 13 | PostgreSQL 16 단일 |
| **REST API** | 없음 | FastAPI |
| **모니터링** | Airflow UI + Flower | API 엔드포인트 |
| **메모리** | 2+ GB | < 1 GB |
| **시작 시간** | ~60초 | ~30초 |

## 아키텍처

```
┌─────────────────┐     ┌──────────────────────────┐     ┌────────────────┐
│  Data Sources    │     │  autonews (1 컨테이너)     │     │  Output        │
│                  │     │                          │     │                │
│ 13+ RSS Feeds    │────▶│ FastAPI    (REST API)     │────▶│ Notion DB      │
│ HackerNews API   │     │ APScheduler (배치 스케줄)   │     │ PostgreSQL     │
│ Dev.to API       │     │ Pipeline   (크롤링 로직)   │     └────────────────┘
│ Substack         │     └────────┬─────────────────┘
└─────────────────┘              │
                       ┌─────────▼──────────┐
                       │  Infra (5 컨테이너)  │
                       │ PostgreSQL 16       │
                       │ Redis 7             │
                       │ Milvus (etcd+minio) │
                       └────────────────────┘
```

## 제거된 컴포넌트

| 컴포넌트 | 역할 | 대체 |
|---------|------|------|
| Airflow Webserver | DAG 관리 UI | FastAPI + Postman |
| Airflow Scheduler | DAG 스케줄링 | APScheduler |
| Airflow Worker | Celery 태스크 실행 | ThreadPoolExecutor |
| Airflow Triggerer | 비동기 트리거 | 제거 |
| Airflow Init | 초기화 | 제거 |
| MySQL 8.4 | 앱 DB | PostgreSQL로 통합 |
| Adminer | MySQL 관리 UI | 제거 |
| Flower | Celery 모니터링 | API 엔드포인트 |
| Milvus Attu UI | 벡터DB 관리 | 제거 |

## 신규 생성 파일 (17개)

### Docker (4개)
| 파일 | 설명 |
|------|------|
| `docker/Dockerfile.autonews` | Python 3.12 slim 기반 경량 이미지 |
| `docker/docker-compose.autonews.yaml` | 6컨테이너 스택 정의 |
| `docker/requirements-autonews.txt` | pip 의존성 (Airflow 제외) |
| `docker/init.sql` | PostgreSQL 스키마 + 시드 데이터 |

### API 서비스 (8개)
| 파일 | 설명 |
|------|------|
| `src/api/main.py` | FastAPI 앱 + 스케줄러 라이프사이클 |
| `src/api/deps.py` | DB 의존성 주입 |
| `src/api/schemas.py` | Pydantic 모델 (요청/응답 검증) |
| `src/api/routers/articles.py` | 아티클 CRUD + 검색 |
| `src/api/routers/feeds.py` | 피드 설정 CRUD |
| `src/api/routers/jobs.py` | 잡 실행 이력 + 수동 트리거 |

### 핵심 모듈 (3개)
| 파일 | 설명 |
|------|------|
| `src/pg_cli.py` | PostgreSQL 클라이언트 (mysql_cli.py 대체) |
| `src/scheduler.py` | APScheduler 기반 배치 스케줄러 |
| `src/pipeline.py` | 파이프라인 러너 (Airflow DAG 대체) |

### 테스트/문서 (2개)
| 파일 | 설명 |
|------|------|
| `postman/Auto-News_API.postman_collection.json` | API 테스트 컬렉션 |
| `LOCAL_TESTING_GUIDE.md` | 로컬 테스트 가이드 |

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `pyproject.toml` | fastapi, uvicorn, apscheduler 추가 / mysql-connector 제거 |
| `src/ops_notion.py` | MySQLClient → PGClient 교체 (3곳) |
| `.env` | LLM_PROVIDER=google, GOOGLE_MODEL=gemini-2.0-flash |

## DB 스키마 (PostgreSQL)

| 테이블 | 역할 | 주요 기능 |
|--------|------|----------|
| `articles` | 크롤링 아티클 저장 | Full-Text Search (tsvector + pg_trgm) |
| `feed_configs` | 피드 설정 관리 | API 런타임 CRUD |
| `job_runs` | 잡 실행 이력 | status, stats, error 추적 |
| `index_pages` | Notion 인덱스 | MySQL에서 마이그레이션 |
| `patches` | 마이그레이션 추적 | MySQL에서 마이그레이션 |

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/health` | 헬스 체크 |
| GET | `/api/v1/scheduler/status` | 스케줄러 상태 |
| GET | `/api/v1/articles` | 아티클 목록 (페이징, 필터) |
| GET | `/api/v1/articles/search?q=` | PostgreSQL FTS 검색 |
| GET | `/api/v1/articles/stats` | 통계 집계 |
| GET | `/api/v1/articles/{hash}` | 단일 아티클 |
| GET/POST/PUT/DELETE | `/api/v1/feeds` | 피드 CRUD |
| GET | `/api/v1/jobs` | 잡 실행 이력 |
| POST | `/api/v1/jobs/{name}/trigger` | 수동 실행 |

## 테스트 결과 (2026-02-20)

| 항목 | RSS | API Crawler | 합계 |
|------|-----|-------------|------|
| Pull | 38 | 10 | 48 |
| Dedup | 38 | 10 | 48 |
| Notion Push | 38 | 10 | **48건 성공** |
| PostgreSQL Save | 38 | 9 | **47건 성공** |

## 알려진 이슈

1. **LLM API quota 초과**: OpenAI/Gemini 무료 티어 한도 → AI Summary 빈 값
2. **Reddit RSS 403**: Reddit 서버 차단 (외부 이슈)
3. **Notion 중복**: Redis flush 후 재실행 시 동일 페이지 중복 생성

## 장점

- 운영 복잡도 대폭 감소 (Airflow 관리 불필요)
- REST API로 외부 시스템 연동 가능
- PostgreSQL FTS로 아티클 검색 기능 추가
- 피드 설정을 API로 런타임 관리 가능
- 기존 크롤링/요약/노션 연동 로직 100% 유지

## 단점

- 기존 auto-news 코드베이스 70+ 파일에 대한 의존성 유지
- 사용하지 않는 레거시 모듈 (af_*.py, dags/) 잔존
- Milvus 스택 (3컨테이너)이 임베딩 스코어링에만 사용
- LLM API 키 관리 복잡 (OpenAI + Google + Ollama)
