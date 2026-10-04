# Test Automation Summary

## Coverage Before vs After

| Layer | Tests Before | Tests After | Coverage Before | Coverage After |
|---|---|---|---|---|
| Python (pytest) | 102 | **131** | 86% | **90%** |
| TypeScript (Jest) | 182 | **189** | 98.91% / 92.1% branch | 99.13% / **94.07% branch** |

## Bug Fixes (기존 테스트 수정)

12개 테스트가 상태 문자열 불일치로 실패 중이었음 → 수정 완료

| 파일 | 수정 내용 |
|---|---|
| `test_crawler_execute.py` | `"COMPLETED"` → `"SUCCESS"`, `"running"` → `"RUNNING"` |
| `test_crawler_fallback.py` | `"COMPLETED"` → `"SUCCESS"`, `"running"` → `"RUNNING"` |
| `test_crawler_generate.py` | `"COMPLETED"` → `"SUCCESS"`, `"running"` → `"RUNNING"` |

## Generated Tests

### Python — New Files

- [x] `api/routers/tests/test_crawler_helpers.py` — `_extract_json()` + `_load_crawl_config_from_code()` 유닛 테스트 (17개)
- [x] `api/routers/tests/test_db_client.py` — DB client 유닛 테스트 (_get_pool, init_pool DSN 정규화, close_pool) (8개)

### Python — Additions to Existing Files

- [x] `test_crawler_analyze.py` — `TestValidationErrorPath` 클래스 추가 (ValidationError → 422 ANALYSIS_PARSE_FAILED 경로, lines 89-90) (3개)

### TypeScript — Additions to Existing Files

- [x] `db/__tests__/crawler-db.test.ts` — `hasDeprecatedRegistry` describe 블록 추가 (빈 rows → `?? false` 분기 포함) (3개)
- [x] `jobs/__tests__/notion-sync.test.ts` — `withRetry(fn, 0)` → `throw new Error('unreachable')` 경로 (1개, line 131)
- [x] `config/__tests__/source-config.test.ts` — source_name 없는 entry (nameHint 빈 문자열 분기), null entry (`(root)` 경로) (2개, line 117)
- [x] `publication/__tests__/github-committer.test.ts` — Error 인스턴스가 아닌 객체(status 있음) → `String(err)` 분기 (1개, line 134)

## Coverage Detail

### Python (api/)

| 모듈 | 변경 전 | 변경 후 | 미커버 라인 |
|---|---|---|---|
| `api/routers/crawler.py` | 64% | **73%** | 117-164 (browser-use 내부), 332-346, 429-458 (crawl4ai 내부) |
| `api/db/client.py` | 24% | **33%** | 86-286 (DB 쿼리 함수 — 실 DB 필요) |
| `api/models/crawler.py` | 99% | 99% | line 11 (모듈 주석) |

### TypeScript (packages/pipeline/src/)

| 파일 | 변경 전 | 변경 후 | 잔여 미커버 |
|---|---|---|---|
| `config/source-config.ts` | 91.66% branch | **100%** | — |
| `db/crawler-db.ts` | 87.5% branch | **100%** | — |
| `publication/github-committer.ts` | 88.88% branch | **100%** | — |
| `jobs/notion-sync.ts` | 100% stmts | 100% stmts | branches 56, 64-65, 80-84, 142 |
| `jobs/browser-crawl.ts` | 98.24% | 98.24% | lines 483, 606, 614 (내부 fallback 경로) |

## Remaining Gaps

### Python — 미커버 이유
- **crawler.py 117-164**: `_run_browser_use_analysis._inner()` — browser-use Agent 실제 호출 경로 (crawl4ai/browser-use 없이 테스트 불가)
- **crawler.py 332-346, 429-458**: `_do_execute`, `_do_fallback` 내부 — `AsyncWebCrawler` 실제 실행 경로
- **db/client.py 86-286**: asyncpg DB 쿼리 함수들 — 실 PostgreSQL 연결 필요 (통합 테스트 영역)

### TypeScript — 미커버 이유
- **browser-crawl.ts 483**: `triggerCode ?? 'FULL_RUN_FAILURE'` — message 없는 에러로 FULL_RUN_FAILURE 폴백 경로
- **browser-crawl.ts 606, 614**: `_processFallbackArticles` 내부 — sourceConfig undefined 상태의 경고/에러 메시지
- **notion-sync.ts 56, 64-65, 80-84, 142**: 일부 Notion API 응답 분기들

## Next Steps

- 통합 테스트 환경 구성 시 `api/db/client.py` 쿼리 함수 테스트 추가
- CI에서 `python -m pytest --cov=api --cov-fail-under=90` 게이트 설정 권장
- browser-crawl.ts 내부 fallback 경로는 별도 통합 테스트 or E2E로 커버 검토
