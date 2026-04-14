export interface KaasAgentEntity {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  api_key: string;
  wallet_address: string | null;
  llm_provider: string;
  llm_model: string | null;
  llm_api_key: string | null;
  karma_tier: string;
  karma_balance: number;
  domain_interests: string[];
  knowledge: { topic: string; lastUpdated: string }[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
