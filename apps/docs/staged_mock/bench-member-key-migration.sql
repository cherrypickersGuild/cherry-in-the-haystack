-- ============================================================
-- Migration: core.app_user에 회원별 벤치마크 Claude API 키(암호화) 컬럼 추가
-- 목적: 벤치마크 실행에 공용 .env 키 대신 회원 본인 Anthropic 키 사용
--       - bench_api_key_enc : AES-256-GCM 암호문 (형식: base64(iv):base64(tag):base64(cipher))
--         복호화 키는 서버 env BENCH_KEY_SECRET. DB엔 평문 절대 저장 안 함.
-- 참고: docs/bench-member-key-implementation-plan.md §3
-- 기존 회원(미등록)엔 영향 없음 (nullable)
-- ============================================================

ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS bench_api_key_enc TEXT NULL;
