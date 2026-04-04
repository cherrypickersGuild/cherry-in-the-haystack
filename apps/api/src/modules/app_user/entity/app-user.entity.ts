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
  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
}
