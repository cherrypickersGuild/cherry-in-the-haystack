-- A2A (Agent-to-Agent) Task 테이블 마이그레이션
-- 2026-04-21
-- A2A 프로토콜로 에이전트 간 전달된 task 영구 기록

CREATE TABLE IF NOT EXISTS kaas.agent_task (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id      UUID NOT NULL REFERENCES kaas.agent(id),
  executor_id       UUID NOT NULL REFERENCES kaas.agent(id),

  task_type         TEXT NOT NULL DEFAULT 'message',
  status            TEXT NOT NULL DEFAULT 'submitted',
  -- 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled'

  input             JSONB NOT NULL,
  output            JSONB,

  session_id        TEXT,
  idempotency_key   TEXT UNIQUE,
  expires_at        TIMESTAMPTZ,

  provenance_hash   TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_task_executor_status
  ON kaas.agent_task(executor_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_task_initiator
  ON kaas.agent_task(initiator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_task_session
  ON kaas.agent_task(session_id);
