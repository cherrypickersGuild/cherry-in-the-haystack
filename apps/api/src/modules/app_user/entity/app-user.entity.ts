export type AppUserRole = 'ADMIN' | 'MANAGER' | 'GENERAL';
export type AppUserTier = 'FREE' | 'PAID' | 'ENTERPRISE';

export interface AppUserEntity {
  id: string;
  email: string;
  name: string | null;
  subscription_tier: AppUserTier;
  role: AppUserRole;
  timezone: string;
  is_active: boolean;
  schedule_weekday: number | null;
  schedule_time: string | null;
  reply_to_email: string | null;
  reply_to_name: string | null;
  last_login_at: Date | null;
  magic_token_hash: Buffer | null;
  magic_token_expires_at: Date | null;
  magic_token_consumed_at: Date | null;
  magic_token_last_ip: string | null;
  magic_token_last_user_agent: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  bench_api_key_enc: string | null;
  /** 벤치 키 만료 시각(등록 + 72h). NULL이면 만료로 간주한다(fail-safe). */
  bench_api_key_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
}
