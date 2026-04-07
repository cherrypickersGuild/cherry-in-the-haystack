export interface UserArticleStateEntity {
  id: string;
  user_id: string;
  article_raw_id: string;
  representative_entity_id: string | null;
  side_category_id: string | null;
  impact_score: number;
  is_high_impact: boolean;
  is_hidden: boolean;
  discovered_at: Date;
  meta_json: unknown | null;
}
