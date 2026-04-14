-- ============================================
-- Cherry KaaS 테이블 v2 — kaas 스키마, 중복 제거
-- 기존 public.kaas_* 드롭 → kaas.agent, kaas.credit_ledger 등
-- ============================================

-- 기존 테이블 드롭 (public 스키마)
DROP TABLE IF EXISTS public.kaas_curator_reward CASCADE;
DROP TABLE IF EXISTS public.kaas_query_log CASCADE;
DROP TABLE IF EXISTS public.kaas_credit_ledger CASCADE;
DROP TABLE IF EXISTS public.kaas_agent CASCADE;

-- kaas 스키마 생성
CREATE SCHEMA IF NOT EXISTS kaas;

-- 0-1. kaas.concept (카탈로그 — 에이전트가 구매하는 지식 상품)
--   summary: 카탈로그 미리보기용 짧은 요약
--   content_md: 구매 후 에이전트에게 전달하는 실제 지식 본문 (마크다운)
CREATE TABLE IF NOT EXISTS kaas.concept (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  summary TEXT NOT NULL,
  content_md TEXT,
  quality_score NUMERIC(3,1) DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  related_concepts JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 0-2. kaas.evidence (개념별 출처 + 큐레이터 코멘트)
CREATE TABLE IF NOT EXISTS kaas.evidence (
  id VARCHAR(100) PRIMARY KEY,
  concept_id VARCHAR(100) NOT NULL REFERENCES kaas.concept(id),
  source VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  curator VARCHAR(100),
  curator_tier VARCHAR(20),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas_evidence_concept ON kaas.evidence (concept_id);

-- 1. kaas.agent (에이전트 등록 정보)
CREATE TABLE IF NOT EXISTS kaas.agent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES core.app_user(id),
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) DEFAULT '🤖',
  api_key TEXT NOT NULL UNIQUE,
  wallet_address VARCHAR(42),
  llm_provider VARCHAR(20) DEFAULT 'claude',
  llm_api_key TEXT,
  karma_tier VARCHAR(20) DEFAULT 'Bronze',
  karma_balance INTEGER DEFAULT 0,
  domain_interests JSONB DEFAULT '[]'::jsonb,
  knowledge JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas_agent_api_key ON kaas.agent (api_key);
CREATE INDEX IF NOT EXISTS idx_kaas_agent_user_id ON kaas.agent (user_id);

-- 2. kaas.credit_ledger (크레딧 입출금 이력)
CREATE TABLE IF NOT EXISTS kaas.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES kaas.agent(id),
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  description VARCHAR(500),
  tx_hash VARCHAR(66),
  chain VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas_credit_agent ON kaas.credit_ledger (agent_id);

-- 3. kaas.query_log (구매/팔로우 이력 + 프로비넌스)
CREATE TABLE IF NOT EXISTS kaas.query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES kaas.agent(id),
  concept_id VARCHAR(100),
  action_type VARCHAR(20) NOT NULL,
  credits_consumed INTEGER NOT NULL,
  provenance_hash VARCHAR(66),
  chain VARCHAR(20),
  response_snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas_query_agent ON kaas.query_log (agent_id);

-- 4. kaas.curator_reward (큐레이터 보상)
CREATE TABLE IF NOT EXISTS kaas.curator_reward (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL,
  query_log_id UUID REFERENCES kaas.query_log(id),
  amount INTEGER NOT NULL,
  withdrawn BOOLEAN DEFAULT false,
  withdrawal_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaas_reward_curator ON kaas.curator_reward (curator_id);
