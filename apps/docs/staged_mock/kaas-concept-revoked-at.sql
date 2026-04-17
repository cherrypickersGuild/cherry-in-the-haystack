-- Migration: add revoked_at to kaas.concept
-- Purpose: distinguish soft-delete (revoke) from hide (is_active=false)
--   hide   → is_active=false, revoked_at IS NULL  (recoverable, not shown in market)
--   delete → is_active=false, revoked_at IS NOT NULL (permanent soft-delete with timestamp)

ALTER TABLE kaas.concept ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL;
