-- ════════════════════════════════════════════════════════════════
-- Purchase Delivery 트랜잭션 테이블
-- "구매 = 에이전트가 content를 받아 ~/.claude/skills/<id>/SKILL.md 로 저장 완료"
-- 3-phase 플로우:
--   Preflight → Reserve(pending) → Deliver → Ack → Finalize(complete)
-- Ack 미도착/실패 시 cancelled 로 마감 (크레딧 차감 없음)
--
-- 주의: kaas.concept.id 는 VARCHAR(100), kaas.agent.id 는 UUID
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kaas.purchase_delivery (
  request_id       UUID PRIMARY KEY,
  agent_id         UUID NOT NULL REFERENCES kaas.agent(id) ON DELETE CASCADE,
  concept_id       VARCHAR(100) NOT NULL REFERENCES kaas.concept(id) ON DELETE CASCADE,
  state            TEXT NOT NULL CHECK (state IN ('pending', 'complete', 'cancelled')),
  saved_path       TEXT,
  size_bytes       INTEGER,
  credit_reserved  INTEGER NOT NULL DEFAULT 0,
  is_reowned       BOOLEAN NOT NULL DEFAULT FALSE, -- ALREADY_OWNED 재전송인 경우 (크레딧 차감 안 함)
  error_reason     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchase_delivery_agent ON kaas.purchase_delivery(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_delivery_concept ON kaas.purchase_delivery(concept_id);
CREATE INDEX IF NOT EXISTS idx_purchase_delivery_state ON kaas.purchase_delivery(state);

COMMENT ON TABLE kaas.purchase_delivery IS 'Purchase 3-phase transaction: Reserve → Deliver (WebSocket) → Ack → Finalize. Each row tracks one save_skill_request lifecycle.';
COMMENT ON COLUMN kaas.purchase_delivery.saved_path IS 'Agent-reported absolute path after successful fs.writeFileSync';
COMMENT ON COLUMN kaas.purchase_delivery.is_reowned IS 'True = 재구매/재전송 (already owned). 크레딧 차감 없이 파일만 재발송';
