import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { SYSTEM_USER_ID } from '../pipeline/article-ingestion.service';

export interface FrameworkEntityItem {
  id: string;
  name: string;
  url: string | null;
  isSpotlight: boolean;
}

export interface FrameworkCategoryItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  entities: FrameworkEntityItem[];
}

export interface FrameworksRisingstar {
  entityName: string;
  title: string;
  oneLiner: string;
  score: number;
  date: string;
  articleStateId: string;
}

export interface FrameworksArticleItem {
  id: string;
  articleStateId: string;
  title: string;
  oneLiner: string;
  entityName: string;
  categoryName: string;
  score: number;
  date: string;
}

export interface FrameworksResponse {
  categories: FrameworkCategoryItem[];
  risingstar: FrameworksRisingstar | null;
  articles: FrameworksArticleItem[];
}

@Injectable()
export class FrameworksService {
  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  async getFrameworks(): Promise<FrameworksResponse> {
    // 1. 카테고리 + 엔터티 위계 (기간 무관)
    const placementRows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        ec.id           AS category_id,
        ec.code         AS category_code,
        ec.name         AS category_name,
        ec.sort_order   AS sort_order,
        te.id           AS entity_id,
        te.name         AS entity_name,
        te.url          AS entity_url,
        te.is_spotlight AS is_spotlight
      FROM content.tracked_entity_placement tep
      JOIN content.entity_category ec
        ON ec.id = tep.entity_category_id
       AND ec.revoked_at IS NULL
      JOIN content.tracked_entity te
        ON te.id = tep.tracked_entity_id
       AND te.revoked_at IS NULL
       AND te.is_active = TRUE
      WHERE tep.entity_page = 'FRAMEWORKS'
        AND tep.revoked_at IS NULL
        AND tep.is_active = TRUE
      ORDER BY ec.sort_order ASC, te.name ASC
    `);

    const categoryMap = new Map<string, FrameworkCategoryItem>();
    for (const r of placementRows.rows) {
      if (!categoryMap.has(r.category_id)) {
        categoryMap.set(r.category_id, {
          id: r.category_id,
          code: r.category_code,
          name: r.category_name,
          sortOrder: r.sort_order,
          entities: [],
        });
      }
      categoryMap.get(r.category_id)!.entities.push({
        id: r.entity_id,
        name: r.entity_name,
        url: r.entity_url ?? null,
        isSpotlight: !!r.is_spotlight,
      });
    }

    const categories = Array.from(categoryMap.values());

    // 2. 아티클 쿼리 (기간 제한 없음 — 전체 FRAMEWORKS)
    const articleRows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        ar.id           AS article_raw_id,
        uas.id          AS article_state_id,
        ar.title,
        ar.published_at,
        aai.ai_summary,
        aai.ai_score,
        aai.representative_entity_name      AS entity_name,
        ec.name                             AS category_name
      FROM content.user_article_state uas
      JOIN content.article_raw ar
        ON ar.id = uas.article_raw_id
      JOIN content.user_article_ai_state aai
        ON aai.user_article_state_id = uas.id
       AND aai.ai_status = 'SUCCESS'
      JOIN personal.entity_follow ef
        ON ef.tracked_entity_id = aai.representative_entity_id
       AND ef.user_id = :systemUserId::UUID
       AND ef.is_following = TRUE
       AND ef.revoked_at IS NULL
      LEFT JOIN content.entity_category ec
        ON ec.id = aai.representative_entity_category_id
      WHERE uas.user_id = :systemUserId::UUID
        AND uas.revoked_at IS NULL
        AND aai.representative_entity_page = 'FRAMEWORKS'
      ORDER BY ar.published_at DESC
    `, { systemUserId: SYSTEM_USER_ID });

    const articles: FrameworksArticleItem[] = articleRows.rows.map((r) => ({
      id: r.article_raw_id,
      articleStateId: r.article_state_id,
      title: r.title,
      oneLiner: r.ai_summary ?? '',
      entityName: r.entity_name ?? '',
      categoryName: r.category_name ?? '',
      score: r.ai_score ?? 0,
      date: new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    // 3. 라이징스타: score 기준 최고점 1개
    const topScored = [...articles].sort((a, b) => b.score - a.score)[0] ?? null;
    const risingstar: FrameworksRisingstar | null = topScored
      ? {
          entityName: topScored.entityName,
          title: topScored.title,
          oneLiner: topScored.oneLiner,
          score: topScored.score,
          date: topScored.date,
          articleStateId: topScored.articleStateId,
        }
      : null;

    return { categories, risingstar, articles };
  }
}
