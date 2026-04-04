# RDS 선배포 전략 (실행본)

## 적용 범위

- 공용 RDS(PostgreSQL 16)에 에이전트/백엔드/배치가 동시에 read/write
- Python 에이전트 SQL 작성 규약 통일
- 스냅샷/집계 테이블까지 포함한 실제 운영 쓰기

참고: [cherry_to_JSON.md](D:/intellij project/cherry-in-the-haystack/docs/cherry_to_JSON.md)

---

## 원칙

1. 선배포: 공용 RDS를 먼저 열고 전원 같은 DB를 사용
2. 권한 분리:
- `app_rw`: 애플리케이션/에이전트 일반 쓰기
- `app_ro`: 조회 전용
- `migration_owner`: DDL 전용
- 운영 계정으로 DDL 실행 금지
3. 커넥션 풀: 초기값은 작게 시작, 수치는 테스트하면서 결정

---

## 배포 절차

1. RDS 생성 + 네트워크/TLS 설정
2. `migration_owner`로 스키마 반영
3. `app_rw`, `app_ro` 계정 생성 및 권한 부여
4. Python 에이전트 연결 테스트 (샘플 upsert)
5. 백엔드 연결 테스트

---

## 에이전트 풀 사이즈 설정 (Python)

- 초기값: 프로세스당 `min_size=1`, `max_size=4`
- 커넥션 합계 계산: `에이전트 프로세스 수 x DB_POOL_MAX`
- NestJS 풀까지 합쳐 RDS 한도 내에서 테스트로 조정

```python
import os
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ["DATABASE_URL"]

pool = ConnectionPool(
    conninfo=DATABASE_URL,
    min_size=int(os.getenv("DB_POOL_MIN", "1")),
    max_size=int(os.getenv("DB_POOL_MAX", "4")),
    timeout=float(os.getenv("DB_POOL_TIMEOUT_SEC", "10")),
    kwargs={"autocommit": False},
)


def db_healthcheck() -> None:
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.commit()
```

`.env` 예시:

```bash
DB_POOL_MIN=1
DB_POOL_MAX=4
DB_POOL_TIMEOUT_SEC=10
```

---

## Python SQL 작성 규약

- `psycopg3` 사용
- SQL 파라미터는 반드시 `%s` 바인딩 (f-string SQL 금지)
- 쓰기는 `INSERT ... ON CONFLICT DO UPDATE` 우선
- 한 작업 단위는 짧은 트랜잭션으로 처리
- 모든 작업은 `run_log`에 `RUNNING -> SUCCESS/FAILED` 남김
- JSON 컬럼은 Python dict/list를 그대로 전달하고 `::jsonb`로 캐스팅

### 공통 유틸 샘플

```python
from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from typing import Iterator

import psycopg

DATABASE_URL = os.environ["DATABASE_URL"]  # app_rw


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.autocommit = False
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
```

### 1) `run_log` 시작/종료

```python
from datetime import datetime, timezone


def start_run(conn: psycopg.Connection, run_kind: str, model_name: str | None = None) -> str:
    run_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO run_log (
                id, run_kind, status, model_name, started_at
            ) VALUES (
                %s, %s, 'RUNNING', %s, %s
            )
            """,
            (run_id, run_kind, model_name, datetime.now(timezone.utc)),
        )
    return run_id


def finish_run(
    conn: psycopg.Connection,
    run_id: str,
    status: str,
    processed_count: int = 0,
    error_msg: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE run_log
            SET status = %s,
                processed_count = %s,
                error_msg = %s,
                ended_at = now()
            WHERE id = %s
            """,
            (status, processed_count, error_msg, run_id),
        )
```

### 2) `article_raw` 멱등 upsert

```python
def upsert_article_raw(
    conn: psycopg.Connection,
    article_id: str,
    source_id: str,
    title: str,
    url: str,
    representative_key: str,
    published_at,
    content_raw: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO article_raw (
                id, source_id, title, url, representative_key, published_at, content_raw
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (representative_key_hash)
            DO UPDATE SET
                title = EXCLUDED.title,
                content_raw = EXCLUDED.content_raw,
                updated_at = now()
            """,
            (article_id, source_id, title, url, representative_key, published_at, content_raw),
        )
```

### 3) `user_article_state` + `user_article_ai_state` upsert

```python
from psycopg.types.json import Json


def upsert_user_article_state(
    conn: psycopg.Connection,
    state_id: str,
    user_id: str,
    article_raw_id: str,
    impact_score: float,
    is_high_impact: bool,
    meta: dict | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_article_state (
                id, user_id, article_raw_id, impact_score, is_high_impact, meta_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (user_id, article_raw_id) WHERE revoked_at IS NULL
            DO UPDATE SET
                impact_score = EXCLUDED.impact_score,
                is_high_impact = EXCLUDED.is_high_impact,
                meta_json = EXCLUDED.meta_json,
                updated_at = now()
            """,
            (state_id, user_id, article_raw_id, impact_score, is_high_impact, Json(meta or {})),
        )


def upsert_user_article_ai_state(
    conn: psycopg.Connection,
    ai_id: str,
    user_id: str,
    user_article_state_id: str,
    run_log_id: str,
    ai_summary: str,
    ai_score: float,
    ai_classification: dict,
    ai_tags: list[str],
    ai_entities: dict,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_article_ai_state (
                id, user_id, user_article_state_id,
                ai_status, ai_summary, ai_score,
                ai_classification_json, ai_tags_json, ai_entities_json,
                run_log_id, ai_processed_at
            ) VALUES (
                %s, %s, %s,
                'SUCCESS', %s, %s,
                %s::jsonb, %s::jsonb, %s::jsonb,
                %s, now()
            )
            ON CONFLICT (user_article_state_id)
            DO UPDATE SET
                ai_status = 'SUCCESS',
                ai_summary = EXCLUDED.ai_summary,
                ai_score = EXCLUDED.ai_score,
                ai_classification_json = EXCLUDED.ai_classification_json,
                ai_tags_json = EXCLUDED.ai_tags_json,
                ai_entities_json = EXCLUDED.ai_entities_json,
                run_log_id = EXCLUDED.run_log_id,
                ai_processed_at = EXCLUDED.ai_processed_at,
                updated_at = now()
            """,
            (
                ai_id,
                user_id,
                user_article_state_id,
                ai_summary,
                ai_score,
                Json(ai_classification),
                Json(ai_tags),
                Json(ai_entities),
                run_log_id,
            ),
        )
```

### 4) 스냅샷 upsert (`highlight_weekly_stat_snapshot`)

```python
def upsert_highlight_weekly_snapshot(
    conn: psycopg.Connection,
    snapshot_id: str,
    user_id: str,
    week_start,
    week_end,
    items_this_week: int,
    topics: list[str],
    new_keywords: list[str],
    treemap: list[dict],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO highlight_weekly_stat_snapshot (
                id, user_id, week_start, week_end,
                items_this_week, covered_topics_json, new_keywords_json, treemap_distribution_json
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s::jsonb, %s::jsonb, %s::jsonb
            )
            ON CONFLICT (user_id, week_start)
            DO UPDATE SET
                week_end = EXCLUDED.week_end,
                items_this_week = EXCLUDED.items_this_week,
                covered_topics_json = EXCLUDED.covered_topics_json,
                new_keywords_json = EXCLUDED.new_keywords_json,
                treemap_distribution_json = EXCLUDED.treemap_distribution_json,
                updated_at = now()
            """,
            (
                snapshot_id,
                user_id,
                week_start,
                week_end,
                items_this_week,
                Json(topics),
                Json(new_keywords),
                Json(treemap),
            ),
        )
```

### 5) 작업 단위 실행 예시

```python
def process_one_batch(user_id: str, items: list[dict]) -> None:
    with get_conn() as conn:
        run_id = start_run(conn, run_kind="ARTICLE_AI_PROCESS", model_name="claude-3-5-sonnet-latest")
        processed = 0
        try:
            for item in items:
                upsert_article_raw(
                    conn=conn,
                    article_id=item["article_id"],
                    source_id=item["source_id"],
                    title=item["title"],
                    url=item["url"],
                    representative_key=item["representative_key"],
                    published_at=item["published_at"],
                    content_raw=item.get("content_raw"),
                )
                upsert_user_article_state(
                    conn=conn,
                    state_id=item["state_id"],
                    user_id=user_id,
                    article_raw_id=item["article_id"],
                    impact_score=item["impact_score"],
                    is_high_impact=item["impact_score"] >= 80,
                    meta=item.get("meta"),
                )
                upsert_user_article_ai_state(
                    conn=conn,
                    ai_id=item["ai_id"],
                    user_id=user_id,
                    user_article_state_id=item["state_id"],
                    run_log_id=run_id,
                    ai_summary=item["ai_summary"],
                    ai_score=item["ai_score"],
                    ai_classification=item["ai_classification_json"],
                    ai_tags=item["ai_tags_json"],
                    ai_entities=item["ai_entities_json"],
                )
                processed += 1

            finish_run(conn, run_id=run_id, status="SUCCESS", processed_count=processed)
        except Exception as exc:
            finish_run(conn, run_id=run_id, status="FAILED", processed_count=processed, error_msg=str(exc))
            raise
```

---

## 스키마 개선 루프

- 불편사항 접수:
  - 쓰기 시 조인 과다
  - JSON 파싱 과다
  - 인덱스 미스
- 배치/백엔드/에이전트 회귀 검증
- 문서 동기화:
  - DDL, JSON 매핑, API 계약을 같은 PR에서 갱신
