-- ============================================================
-- Migration: 크롤러 자동생성 시스템 테이블 추가
-- ============================================================
-- DBeaver에서 실행할 것 (Supabase, PostgreSQL 16)
--
-- 목적: 사이트 분석 → 크롤러 코드 자동생성 → PR → 실행 파이프라인용 테이블 추가.
--   crawler_analysis  : AI 사이트 구조 분석 결과 (소스당 1행)
--   crawler_registry  : 생성된 크롤러 코드 + 생명주기 (소스당 active 1개)
--
-- ⚠️ 원본 요청(DB_info.md) 대비 충돌 제거 내역:
--   [제거] content.article_raw 생성       → 이미 ddl-v1.1.sql:635 에 존재. 절대 재생성 금지.
--                                            (representative_key_hash/url_hash 등은 GENERATED ALWAYS,
--                                             코드에서 직접 INSERT 하면 에러. published_at 은 TIMESTAMPTZ.)
--   [제거] content.source 컬럼 추가        → consecutive_failures / last_success_at 이미 존재 (ddl-v1.1.sql:549,552).
--
-- 참조 무결성 검증(ddl-v1.1.sql 대조 완료):
--   content.source(id) UUID            ✓ (line 528)
--   core.prompt_template_version(id)   ✓ (line 411)
--   core.run_log(id) UUID              ✓ (line 462)
--   core.set_updated_at() 범용 트리거   ✓ (line 209)
--   core.run_kind_enum                 ✓ (line 131)
--
-- soft-delete 정책 (재검토 결론):
--   crawler_analysis : revoked_at 미사용. 소스당 1행 UPSERT(덮어쓰기)가 설계 의도이므로
--                      무조건 unique(source_id) 유지 → ON CONFLICT(source_id) 단순 형태 동작.
--                      (부분 unique 로 바꾸면 ON CONFLICT 가 깨지고, registry.analysis_id FK 도 위험)
--   crawler_registry : revoked_at 미사용. status enum(pending_review/active/deprecated)이
--                      생명주기를 관리하며 'deprecated' 가 곧 soft-delete. 중복 컬럼 불필요.
--
-- 실행 순서 주의: Step 1(enum 값 추가)은 반드시 별도 트랜잭션에서 먼저 commit.
--   (PostgreSQL 제약: ALTER TYPE ... ADD VALUE 는 같은 트랜잭션 내 즉시 사용 불가)
-- ============================================================


-- ============================================================
-- Step 1 — core.run_kind_enum 값 추가  ★ 별도 트랜잭션으로 먼저 실행 ★
-- ============================================================
-- 아래 4줄만 따로 실행하고 commit 한 뒤, Step 2 이후를 실행하세요.

ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_ANALYSIS';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_GENERATION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_EXECUTION';
ALTER TYPE core.run_kind_enum ADD VALUE IF NOT EXISTS 'CRAWLER_FALLBACK';


-- ============================================================
-- Step 2 — content.crawler_status_enum 생성
-- ============================================================
DO $$ BEGIN
    CREATE TYPE content.crawler_status_enum AS ENUM (
        'pending_review',
        'active',
        'deprecated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- Step 3 — content.crawler_analysis
--   AI가 소스 사이트를 분석한 결과 저장. 소스당 1행 (재분석 시 UPSERT).
-- ============================================================
CREATE TABLE IF NOT EXISTS content.crawler_analysis (
    id                         UUID         NOT NULL,
    source_id                  UUID         NOT NULL,
    analysis_json              JSONB        NOT NULL,
    prompt_template_version_id UUID         NULL,
    run_log_id                 UUID         NULL,
    model_name                 VARCHAR(100) NULL,
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

-- 소스당 1행 강제. 재분석은 ON CONFLICT (source_id) DO UPDATE 로 in-place 덮어쓰기.
-- (무조건 unique 라야 단순 ON CONFLICT 가 동작하고, id 가 유지되어 registry.analysis_id FK 가 안정)
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_analysis_source
    ON content.crawler_analysis (source_id);

DO $$ BEGIN
    CREATE TRIGGER trg_crawler_analysis_set_updated_at
        BEFORE UPDATE ON content.crawler_analysis
        FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- Step 4 — content.crawler_registry
--   생성된 크롤러 코드 + 생명주기 관리. 소스당 active 는 1개만.
-- ============================================================
CREATE TABLE IF NOT EXISTS content.crawler_registry (
    id                   UUID                        NOT NULL,
    source_id            UUID                        NOT NULL,
    analysis_id          UUID                        NULL,
    status               content.crawler_status_enum NOT NULL DEFAULT 'pending_review',
    generated_code       TEXT                        NOT NULL,
    pr_number            INT                         NULL,
    pr_url               VARCHAR(1000)               NULL,
    pr_merged_at         TIMESTAMPTZ                 NULL,
    consecutive_failures INT                         NOT NULL DEFAULT 0,
    run_log_id           UUID                        NULL,
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

-- 소스당 active 크롤러는 1개만 허용. (deprecated 행은 여러 개 누적 = 버전 히스토리)
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
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- [SKIP] Step 5 — content.article_raw
-- ============================================================
-- 원본 요청에 있었으나 제거함. ddl-v1.1.sql:635 에 이미 존재.
-- 크롤러 코드는 기존 스키마에 맞춰 작성할 것:
--   - representative_key_hash, url_hash, guid_hash, normalized_url_hash, canonical_url_hash
--     → 전부 GENERATED ALWAYS (DB 자동계산). INSERT/UPDATE 대상에서 제외할 것.
--   - INSERT 시 채울 것: representative_key(TEXT), url, published_at(TIMESTAMPTZ NOT NULL),
--     title, content_raw, source_id, id 등.
--   - content_hash 는 nullable BYTEA(32). 직접 넣으려면 octet_length=32 지킬 것.


-- ============================================================
-- [SKIP] Step 6 — content.source 컬럼 추가
-- ============================================================
-- consecutive_failures / last_success_at 둘 다 이미 존재 (ddl-v1.1.sql:549,552). 작업 불필요.
