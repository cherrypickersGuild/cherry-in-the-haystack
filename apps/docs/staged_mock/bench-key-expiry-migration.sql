-- 벤치마크 API 키 72시간 자동 만료
-- 기획서: apps/docs/bench-key-72h-expiry-implementation-plan.md
--
-- ⚠️ 로컬·프로덕션이 같은 Supabase DB를 공유한다. 이 스크립트는 1회만 적용할 것.
-- 모든 구문이 재실행 안전(idempotent)하다.

-- 1) 만료 시각 컬럼
ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS bench_api_key_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN core.app_user.bench_api_key_expires_at
  IS '벤치마크용 Anthropic API 키의 만료 시각. 등록 시점 + 72시간. NULL이면 만료로 간주(fail-safe).';

-- 2) 기존에 등록된 키는 즉시 만료 (D1 확정)
--    만료 시각을 알 수 없는 키를 남기지 않는다.
--    → 'expires_at 이 NULL 인 유효 키'라는 예외 상태가 아예 사라져 로직이 단순해진다.
UPDATE core.app_user
   SET bench_api_key_enc        = NULL,
       bench_api_key_expires_at = NULL,
       updated_at               = NOW()
 WHERE bench_api_key_enc IS NOT NULL;

-- 3) 청소 크론용 부분 인덱스 (키가 있는 행만 대상)
CREATE INDEX IF NOT EXISTS idx_app_user_bench_key_expires
  ON core.app_user (bench_api_key_expires_at)
  WHERE bench_api_key_enc IS NOT NULL;

-- 확인용
-- SELECT COUNT(*) AS remaining_keys FROM core.app_user WHERE bench_api_key_enc IS NOT NULL;
