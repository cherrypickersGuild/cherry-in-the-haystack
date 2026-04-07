export interface ArticleRawEntity {
  id: string;
  source_id: string;
  title: string;
  url: string;
  published_at: Date | null;
  representative_key: string;
  language: string | null;
  content_raw: string | null;
  fetched_at: Date;
  storage_state: string;
}
