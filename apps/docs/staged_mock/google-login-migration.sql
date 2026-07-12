-- ============================================================
-- Migration: core.app_user에 Google 로그인 컬럼 추가
-- 목적: "Google로 로그인"(Google Identity Services) 지원
--       - google_sub : 구글 계정 고유 ID(sub) — 이메일 변경/중복 대비 안정적 식별자
--       - avatar_url : 구글 프로필 사진 URL
-- 참고: docs/google-login-implementation-plan.md §3
-- 매직링크(기존 이메일 로그인) 유저에는 영향 없음 (둘 다 NULL 허용)
-- ============================================================

-- 1. 구글 계정 고유 ID
ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);

-- 2. 프로필 사진 URL
ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1000);

-- 3. google_sub 중복 방지 (NULL 허용 partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_google_sub
  ON core.app_user (google_sub)
  WHERE google_sub IS NOT NULL;
