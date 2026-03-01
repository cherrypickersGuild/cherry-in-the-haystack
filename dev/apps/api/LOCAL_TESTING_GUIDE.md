# Auto-News Local Testing Guide

## Prerequisites

- Docker & Docker Compose v2
- `.env` 파일 설정 완료 (`.env.template` 참고)

---

## 1. 환경 설정

### 1.1 .env 파일 준비

```bash
cd dev-cherry/cherry-in-the-haystack/dev/apps/api

# .env.template 기반으로 .env 생성 (이미 있으면 스킵)
cp .env.template .env
```

**.env에서 반드시 확인할 항목:**

```bash
# 최소 필수 (이것만 있으면 RSS 파이프라인 동작)
NOTION_TOKEN=ntn_...
NOTION_ENTRY_PAGE_ID=...
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-ada-002

# 아래는 docker-compose에서 자동 주입 (수정 불필요)
# DATABASE_URL, BOT_REDIS_URL, MILVUS_HOST, MILVUS_PORT
```

### 1.2 MySQL 관련 변수 제거/무시

`.env`에 아직 MySQL 설정이 있어도 무방합니다. 새 시스템은 사용하지 않습니다.

---

## 2. Docker Compose 실행

### 2.1 전체 스택 시작

```bash
cd dev-cherry/cherry-in-the-haystack/dev/apps/api

# 새 경량 스택 시작 (6 컨테이너)
docker compose -f docker/docker-compose.autonews.yaml up -d
```

### 2.2 빌드만 다시 하기 (코드 수정 후)

```bash
docker compose -f docker/docker-compose.autonews.yaml up -d --build autonews
```

### 2.3 시작 순서 확인

```bash
# 전체 상태 확인
docker compose -f docker/docker-compose.autonews.yaml ps

# 기대 결과:
# autonews-postgres   running (healthy)
# autonews-redis      running (healthy)
# autonews-etcd       running
# autonews-minio      running (healthy)
# autonews-milvus     running
# autonews-api        running
```

### 2.4 로그 확인

```bash
# autonews 서비스 로그 (FastAPI + Scheduler)
docker compose -f docker/docker-compose.autonews.yaml logs -f autonews

# PostgreSQL 로그
docker compose -f docker/docker-compose.autonews.yaml logs -f postgres

# 전체 로그
docker compose -f docker/docker-compose.autonews.yaml logs -f
```

---

## 3. API 동작 확인

### 3.1 Health Check

```bash
curl http://localhost:8000/api/v1/health
```

기대 응답:
```json
{"status": "ok", "timestamp": "2026-02-15T12:00:00"}
```

### 3.2 Scheduler 상태

```bash
curl http://localhost:8000/api/v1/scheduler/status
```

기대 응답:
```json
{
  "running": true,
  "jobs": [
    {"id": "news_pulling", "name": "News Pulling (RSS + API + Substack)", "next_run_time": "...", "trigger": "cron[minute='15']"},
    {"id": "sync_dist", "name": "Sync Distribution (Milvus embeddings)", "next_run_time": "...", "trigger": "cron[minute='1']"},
    {"id": "collection_weekly", ...},
    {"id": "journal_daily", ...},
    {"id": "action", ...}
  ]
}
```

### 3.3 Feed 설정 확인

```bash
# 전체 피드 목록 (init.sql에서 시드된 15개)
curl http://localhost:8000/api/v1/feeds

# 새 피드 추가
curl -X POST http://localhost:8000/api/v1/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Feed",
    "url": "https://example.com/rss",
    "source_type": "rss",
    "category": "insights",
    "enabled": false,
    "count": 3
  }'

# 피드 비활성화
curl -X PUT http://localhost:8000/api/v1/feeds/1 \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### 3.4 아티클 조회

```bash
# 전체 목록 (파이프라인 실행 후 데이터 있음)
curl "http://localhost:8000/api/v1/articles?page=1&size=10"

# 소스별 필터
curl "http://localhost:8000/api/v1/articles?source=RSS"

# 카테고리별 필터
curl "http://localhost:8000/api/v1/articles?category=insights"

# 날짜 범위
curl "http://localhost:8000/api/v1/articles?from_date=2026-02-01&to_date=2026-02-15"

# Full-Text Search (PostgreSQL FTS)
curl "http://localhost:8000/api/v1/articles/search?q=LLM+agent"

# 통계
curl http://localhost:8000/api/v1/articles/stats

# 단일 아티클 (article_hash)
curl http://localhost:8000/api/v1/articles/{article_hash}
```

---

## 4. 파이프라인 수동 실행

### 4.1 API로 트리거

```bash
# news_pulling 수동 실행 (RSS + API Crawler + Substack)
curl -X POST http://localhost:8000/api/v1/jobs/news_pulling/trigger

# 사용 가능한 잡 이름:
# news_pulling, sync_dist, collection_weekly, journal_daily, action
```

### 4.2 컨테이너 안에서 직접 실행

```bash
# 컨테이너 접속
docker exec -it autonews-api bash

# 파이프라인 직접 실행
cd /app/src
python pipeline.py news_pulling

# 사용 가능한 파이프라인:
python pipeline.py news_pulling
python pipeline.py sync_dist
python pipeline.py collection_weekly
python pipeline.py journal_daily
python pipeline.py action
```

### 4.3 실행 이력 확인

```bash
# 잡 실행 기록
curl http://localhost:8000/api/v1/jobs

# 특정 잡의 최근 실행
curl http://localhost:8000/api/v1/jobs/news_pulling/latest
```

---

## 5. PostgreSQL 직접 확인

### 5.1 psql 접속

```bash
# 호스트에서 직접 접속 (포트 5432 노출)
psql postgresql://autonews:autonews@localhost:5432/autonews

# 또는 컨테이너 안에서
docker exec -it autonews-postgres psql -U autonews
```

### 5.2 데이터 확인 쿼리

```sql
-- 테이블 확인
\dt

-- 시드 피드 확인 (15개)
SELECT id, name, source_type, category, enabled FROM feed_configs;

-- 아티클 수 확인
SELECT source, COUNT(*) FROM articles GROUP BY source;

-- Full-Text Search 테스트
SELECT title, ts_rank(search_vector, websearch_to_tsquery('english', 'LLM agent')) AS rank
FROM articles
WHERE search_vector @@ websearch_to_tsquery('english', 'LLM agent')
ORDER BY rank DESC
LIMIT 10;

-- 잡 실행 기록
SELECT job_name, status, started_at, finished_at, stats
FROM job_runs
ORDER BY started_at DESC
LIMIT 10;

-- pg_trgm 유사도 검색 테스트
SELECT title, similarity(title, 'machine learning') AS sim
FROM articles
WHERE title % 'machine learning'
ORDER BY sim DESC
LIMIT 10;
```

---

## 6. 개발 모드 (소스 핫 리로드)

`docker-compose.autonews.yaml`에서 `src/` 디렉토리가 볼륨 마운트되어 있으므로, 코드를 수정하면 컨테이너 재시작만으로 반영됩니다.

```bash
# 코드 수정 후 autonews만 재시작
docker compose -f docker/docker-compose.autonews.yaml restart autonews
```

uvicorn에 `--reload` 옵션을 추가하려면:

```bash
# docker-compose.autonews.yaml의 autonews 서비스에 command 추가
# command: ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

또는 로컬에서 직접 실행 (인프라만 Docker, 앱은 로컬):

```bash
# 인프라만 올리기 (postgres, redis, milvus)
docker compose -f docker/docker-compose.autonews.yaml up -d postgres redis etcd milvus-minio milvus-standalone

# .env에 로컬 접속 정보 설정
export DATABASE_URL=postgresql://autonews:autonews@localhost:5432/autonews
export BOT_REDIS_URL=redis://:@localhost:6379/1
export MILVUS_HOST=localhost
export MILVUS_PORT=19530

# 로컬에서 FastAPI 실행
cd src
pip install -r ../docker/requirements-autonews.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 7. 정리

```bash
# 전체 종료
docker compose -f docker/docker-compose.autonews.yaml down

# 데이터 포함 종료 (PostgreSQL, Redis, Milvus 데이터 삭제)
docker compose -f docker/docker-compose.autonews.yaml down -v

# 볼륨 데이터 수동 삭제
rm -rf docker/workspace/
```

---

## 8. Troubleshooting

### PostgreSQL 접속 실패

```bash
# healthcheck 상태 확인
docker inspect autonews-postgres | jq '.[0].State.Health'

# init.sql 실행 여부 확인 (첫 시작시만 실행됨)
docker logs autonews-postgres 2>&1 | grep "init.sql"

# 데이터 초기화 후 재시작 (init.sql 재실행)
docker compose -f docker/docker-compose.autonews.yaml down
rm -rf docker/workspace/postgres
docker compose -f docker/docker-compose.autonews.yaml up -d
```

### autonews 서비스가 시작 안 될 때

```bash
# 로그 확인
docker compose -f docker/docker-compose.autonews.yaml logs autonews

# 흔한 원인:
# 1. .env 파일 없음 → cp .env.template .env
# 2. postgres/redis 아직 안 올라옴 → depends_on + healthcheck로 자동 대기
# 3. 파이썬 모듈 에러 → docker compose ... up -d --build autonews
```

### Milvus 접속 실패

```bash
# Milvus는 etcd + minio 의존, 시작까지 30~60초 소요
docker logs autonews-milvus 2>&1 | tail -20

# Milvus 포트 확인
curl -s http://localhost:19530/healthz
```

### 데이터가 안 쌓일 때

```bash
# 1. 스케줄러 상태 확인
curl http://localhost:8000/api/v1/scheduler/status

# 2. 수동 트리거로 파이프라인 실행
curl -X POST http://localhost:8000/api/v1/jobs/news_pulling/trigger

# 3. 잡 실행 결과 확인
curl http://localhost:8000/api/v1/jobs/news_pulling/latest
# status가 "failed"면 error_msg 확인

# 4. 컨테이너 로그에서 상세 에러 확인
docker compose -f docker/docker-compose.autonews.yaml logs -f autonews
```
