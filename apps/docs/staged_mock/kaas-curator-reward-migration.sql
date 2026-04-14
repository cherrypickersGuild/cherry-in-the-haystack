-- kaas 큐레이터 보상 마이그레이션
-- DBeaver에서 실행할 것

-- 1. kaas.concept에 큐레이터 지갑 주소 추가
ALTER TABLE kaas.concept
  ADD COLUMN IF NOT EXISTS curator_wallet VARCHAR(42) DEFAULT NULL;

-- 2. kaas.curator_reward 재구성 (curator_id UUID → curator_name + curator_wallet + concept_id)
--    기존 테이블 드롭 후 재생성 (데이터 없으면 안전)
DROP TABLE IF EXISTS kaas.curator_reward;

CREATE TABLE kaas.curator_reward (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    VARCHAR(100) REFERENCES kaas.concept(id),
  query_log_id  UUID REFERENCES kaas.query_log(id),
  curator_name  VARCHAR(100) NOT NULL,
  curator_wallet VARCHAR(42),
  amount        INTEGER NOT NULL,
  withdrawn     BOOLEAN DEFAULT false,
  tx_hash       VARCHAR(66),       -- 온체인 보상 기록 tx
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas_reward_curator_name ON kaas.curator_reward (curator_name);
CREATE INDEX IF NOT EXISTS idx_kaas_reward_concept ON kaas.curator_reward (concept_id);
CREATE INDEX IF NOT EXISTS idx_kaas_reward_withdrawn ON kaas.curator_reward (withdrawn);

-- 3. 데모용 큐레이터 지갑 주소 업데이트
--    (개인화 전까지 deployer 지갑으로 통일)
UPDATE kaas.concept
SET curator_wallet = '0xd4452aa4Ea996995aF94FbC4aEE4929BbCEBe7C4'
WHERE curator_wallet IS NULL;
