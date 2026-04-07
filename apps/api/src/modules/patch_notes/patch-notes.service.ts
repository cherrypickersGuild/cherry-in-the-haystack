import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { SYSTEM_USER_ID } from '../pipeline/article-ingestion.service';

const PAGE_LABEL: Record<string, string> = {
  MODEL_UPDATES:    'Models',
  PAPER_BENCHMARK:  'Research',
  FRAMEWORKS:       'Frameworks',
  TOOLS:            'Tools',
  SHARED_RESOURCES: 'Resources',
  CASE_STUDIES:     'Case Study',
  REGULATIONS:      'Regulations',
  BIG_TECH_TRENDS:  'Big Tech',
  THIS_WEEKS_POSTS: 'Posts',
};

const PAGE_COLOR: Record<string, string> = {
  MODEL_UPDATES:    '#C94B6E',
  PAPER_BENCHMARK:  '#7B5EA7',
  FRAMEWORKS:       '#7B5EA7',
  TOOLS:            '#2D7A5E',
  SHARED_RESOURCES: '#2D7A5E',
  CASE_STUDIES:     '#2D7A5E',
  REGULATIONS:      '#9E97B3',
  BIG_TECH_TRENDS:  '#D4854A',
  THIS_WEEKS_POSTS: '#D4854A',
};

export interface PatchNoteItem {
  id: string;
  articleStateId: string;
  date: string;
  page: string;
  area: string;
  categoryName: string;
  dotColor: string;
  entityName: string;
  title: string;
  oneLiner: string;
  score: number;
  isRead: boolean;
  sideCategory: string | null;
}

export interface PatchNotesStats {
  totalUpdates: number;
  score5Items: number;
  newFrameworks: number;
  regulatory: number;
}

export interface PatchNotesResponse {
  items: PatchNoteItem[];
  stats: PatchNotesStats;
  period: { from: string; to: string };
  areas: number;
}

@Injectable()
export class PatchNotesService {
  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  async getPatchNotes(): Promise<PatchNotesResponse> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    const rows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        uas.id                                   AS article_state_id,
        ar.id                                    AS article_raw_id,
        ar.title,
        ar.published_at,
        aai.ai_summary,
        aai.ai_score,
        aai.representative_entity_page           AS page,
        aai.representative_entity_name           AS entity_name,
        ec.name                                  AS category_name,
        sc.code                                  AS side_category_code,
        uas.read_at
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
      LEFT JOIN content.side_category sc
        ON sc.id = uas.side_category_id
      WHERE uas.user_id = :systemUserId::UUID
        AND uas.revoked_at IS NULL
        AND ar.published_at >= :from
        AND ar.published_at < :to
      ORDER BY ar.published_at DESC
    `, { systemUserId: SYSTEM_USER_ID, from, to });

    const items: PatchNoteItem[] = rows.rows.map((r) => ({
      id: r.article_raw_id,
      articleStateId: r.article_state_id,
      date: this.formatDate(r.published_at),
      page: r.page ?? '',
      area: PAGE_LABEL[r.page] ?? r.page ?? 'Unknown',
      categoryName: r.category_name ?? '',
      dotColor: PAGE_COLOR[r.page] ?? '#9E97B3',
      entityName: r.entity_name ?? '',
      title: r.title,
      oneLiner: r.ai_summary ?? '',
      score: r.ai_score ?? 0,
      isRead: !!r.read_at,
      sideCategory: r.side_category_code ?? null,
    }));

    const pages = new Set(items.map((i) => i.page));

    const stats: PatchNotesStats = {
      totalUpdates: items.length,
      score5Items: items.filter((i) => i.score === 5).length,
      newFrameworks: items.filter((i) => i.page === 'FRAMEWORKS').length,
      regulatory: items.filter((i) => i.page === 'REGULATIONS').length,
    };

    return {
      items,
      stats,
      areas: pages.size,
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
    };
  }

  async markAsRead(articleStateId: string): Promise<void> {
    await this.knex('content.user_article_state')
      .where({ id: articleStateId, user_id: SYSTEM_USER_ID })
      .whereNull('read_at')
      .update({ read_at: new Date() });
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
