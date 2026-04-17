-- ============================================================
-- Migration: NEAR 지갑 지원을 위한 스키마 확장
-- - wallet_address: VARCHAR(42) → VARCHAR(128) (NEAR 계정 최대 64자 대응)
-- - wallet_type: 'evm' | 'near' 구분
-- ============================================================

-- 1. kaas.agent
ALTER TABLE kaas.agent
  ALTER COLUMN wallet_address TYPE VARCHAR(128);

ALTER TABLE kaas.agent
  ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(10) DEFAULT 'evm';

-- 기존 데이터 보정 — 0x로 시작하면 evm, 그 외(NEAR 계정)는 near
UPDATE kaas.agent
  SET wallet_type = CASE
    WHEN wallet_address LIKE '0x%' THEN 'evm'
    WHEN wallet_address IS NOT NULL AND wallet_address != '' THEN 'near'
    ELSE 'evm'
  END
  WHERE wallet_type IS NULL OR wallet_type = 'evm';

-- 2. core.app_user (유저는 개인화된 카르마 조회용으로 한 개만 저장)
ALTER TABLE core.app_user
  ALTER COLUMN wallet_address TYPE VARCHAR(128);
