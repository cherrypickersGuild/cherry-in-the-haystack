-- ============================================================
-- System User Seed
-- Cherry Platform — Reserved system account
--
-- ID: 00000000-0000-7000-8000-000000000001
-- 용도: 개인화 없는 공통(public) user_article_state의 user_id로 사용
--      실제 로그인 불가 (magic_token 없음, email은 내부 전용)
-- 안전: 중복 실행 무해 (ON CONFLICT DO NOTHING)
-- ============================================================

INSERT INTO core.app_user (
    id,
    email,
    name,
    subscription_tier,
    role,
    timezone,
    is_active,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system@cherry.internal',
    '__SYSTEM__',
    'FREE',
    'ADMIN',
    'UTC',
    true,
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;
