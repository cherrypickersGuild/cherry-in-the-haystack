import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

@Injectable()
export class LandingStatService {
  private readonly logger = new Logger(LandingStatService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  /**
   * 오늘 기준 platform_weekly_stat UPSERT
   * - treemap_distribution_json: 페이지별 기사 비율 (이번 7일)
   * - top_momentum_entities_json: 전주 대비 기사 수 증가율 top 5 (크로스 페이지)
   */
  async buildDailyStat(): Promise<{ upserted: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const statDate = today.toISOString().slice(0, 10);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6);

    const ws = weekStart.toISOString().slice(0, 10);
    const pws = prevWeekStart.toISOString().slice(0, 10);
    const pwe = prevWeekEnd.toISOString().slice(0, 10);

    // ── 1. Treemap: 페이지별 기사 수 ──────────────────────────
    const treemapRaw = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        aai.representative_entity_page AS page,
        COUNT(DISTINCT uas.article_raw_id) AS article_count
      FROM content.user_article_ai_state aai
      JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
      JOIN content.article_raw ar ON ar.id = uas.article_raw_id
      WHERE aai.ai_status = 'SUCCESS'
        AND ar.published_at >= :weekStart::DATE
        AND ar.published_at < :weekEnd::DATE + INTERVAL '1 day'
      GROUP BY aai.representative_entity_page
      ORDER BY article_count DESC
    `, { weekStart: ws, weekEnd: statDate });

    const total = treemapRaw.rows.reduce((s: number, r: any) => s + Number(r.article_count), 0);
    const treemapJson = treemapRaw.rows.map((r: any) => ({
      page: r.page,
      article_count: Number(r.article_count),
      percent: total > 0 ? Number(((Number(r.article_count) / total) * 100).toFixed(1)) : 0,
    }));

    // ── 2. Momentum: 엔터티별 이번 7일 vs 이전 7일 ──────────
    const currentEntityRows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        aai.representative_entity_id   AS entity_id,
        aai.representative_entity_name AS entity_name,
        aai.representative_entity_page AS page,
        aai.representative_entity_category_name AS category_name,
        COUNT(DISTINCT uas.article_raw_id) AS cnt
      FROM content.user_article_ai_state aai
      JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
      JOIN content.article_raw ar ON ar.id = uas.article_raw_id
      WHERE aai.ai_status = 'SUCCESS'
        AND ar.published_at >= :weekStart::DATE
        AND ar.published_at < :weekEnd::DATE + INTERVAL '1 day'
      GROUP BY
        aai.representative_entity_id,
        aai.representative_entity_name,
        aai.representative_entity_page,
        aai.representative_entity_category_name
    `, { weekStart: ws, weekEnd: statDate });

    const prevEntityRows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        aai.representative_entity_id AS entity_id,
        COUNT(DISTINCT uas.article_raw_id) AS cnt
      FROM content.user_article_ai_state aai
      JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
      JOIN content.article_raw ar ON ar.id = uas.article_raw_id
      WHERE aai.ai_status = 'SUCCESS'
        AND ar.published_at >= :prevWeekStart::DATE
        AND ar.published_at < :prevWeekEnd::DATE + INTERVAL '1 day'
      GROUP BY aai.representative_entity_id
    `, { prevWeekStart: pws, prevWeekEnd: pwe });

    const prevMap = new Map<string, number>(
      prevEntityRows.rows.map((r: any) => [r.entity_id, Number(r.cnt)]),
    );

    const momentumEntities = currentEntityRows.rows
      .map((r: any) => {
        const thisWeekCount = Number(r.cnt);
        const prevWeekCount = prevMap.get(r.entity_id) ?? 0;
        const changePct =
          prevWeekCount === 0
            ? null
            : Number((((thisWeekCount - prevWeekCount) / prevWeekCount) * 100).toFixed(1));
        return {
          entity_id: r.entity_id,
          entity_name: r.entity_name,
          page: r.page,
          category_name: r.category_name,
          this_week_count: thisWeekCount,
          prev_week_count: prevWeekCount,
          change_pct: changePct,
        };
      })
      .filter((e) => e.change_pct !== null && e.change_pct > 0)
      .sort((a, b) => (b.change_pct as number) - (a.change_pct as number))
      .slice(0, 5);

    // ── 3. Upsert platform_weekly_stat ────────────────────────
    const itemsThisWeek = total;

    await this.knex.raw(`
      INSERT INTO snapshot.platform_weekly_stat
        (id, week_start, week_end,
         items_this_week, items_delta_vs_last_week,
         topics_covered_count,
         score_5_items_count,
         treemap_distribution_json,
         top_momentum_entities_json)
      VALUES
        (gen_random_uuid(), :weekStart, :weekEnd,
         :itemsThisWeek, 0,
         :topicsCovered,
         0,
         :treemapJson::JSONB,
         :momentumJson::JSONB)
      ON CONFLICT (week_start) DO UPDATE SET
        week_end                    = EXCLUDED.week_end,
        items_this_week             = EXCLUDED.items_this_week,
        topics_covered_count        = EXCLUDED.topics_covered_count,
        treemap_distribution_json   = EXCLUDED.treemap_distribution_json,
        top_momentum_entities_json  = EXCLUDED.top_momentum_entities_json,
        updated_at                  = NOW()
    `, {
      weekStart: ws,
      weekEnd: statDate,
      itemsThisWeek,
      topicsCovered: treemapRaw.rows.length,
      treemapJson: JSON.stringify(treemapJson),
      momentumJson: JSON.stringify(momentumEntities),
    });

    this.logger.log(`landing buildDailyStat done — week: ${ws}~${statDate}, treemap pages: ${treemapJson.length}, momentum entities: ${momentumEntities.length}`);
    return { upserted: 1 };
  }

  /**
   * 랜딩 페이지 데이터 반환
   * - treemap (페이지별 기사 비율)
   * - topMomentumEntities (전주 대비 성장률 top 5)
   * - topArticles (score 5, 최근 7일, limit 5)
   */
  async getLanding(): Promise<{
    weekStart: string;
    weekEnd: string;
    treemap: { page: string; articleCount: number; percent: number }[];
    topMomentumEntities: {
      entityId: string;
      entityName: string;
      page: string;
      categoryName: string;
      thisWeekCount: number;
      prevWeekCount: number;
      changePct: number;
    }[];
    topArticles: {
      id: string;
      title: string;
      oneLiner: string;
      entityName: string;
      categoryName: string;
      score: number;
      date: string;
      page: string;
    }[];
  }> {
    const latest = await this.knex('snapshot.platform_weekly_stat')
      .orderBy('week_start', 'desc')
      .limit(1)
      .first(
        'week_start',
        'week_end',
        'treemap_distribution_json',
        'top_momentum_entities_json',
      );

    if (!latest) {
      return { weekStart: '', weekEnd: '', treemap: [], topMomentumEntities: [], topArticles: [] };
    }

    const treemap = (latest.treemap_distribution_json ?? []).map((t: any) => ({
      page: t.page,
      articleCount: t.article_count,
      percent: t.percent,
    }));

    const topMomentumEntities = (latest.top_momentum_entities_json ?? []).map((e: any) => ({
      entityId: e.entity_id,
      entityName: e.entity_name,
      page: e.page,
      categoryName: e.category_name,
      thisWeekCount: e.this_week_count,
      prevWeekCount: e.prev_week_count,
      changePct: e.change_pct,
    }));

    // 최근 score 5 기사 5건
    const weekStart = new Date(latest.week_start);
    const topArticleRows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        uas.id,
        ar.title,
        aai.ai_summary AS one_liner,
        aai.representative_entity_name AS entity_name,
        aai.representative_entity_category_name AS category_name,
        aai.ai_score AS score,
        ar.published_at::DATE AS date,
        aai.representative_entity_page AS page
      FROM content.user_article_state uas
      JOIN content.article_raw ar ON ar.id = uas.article_raw_id
      JOIN content.user_article_ai_state aai ON aai.user_article_state_id = uas.id
      WHERE aai.ai_status = 'SUCCESS'
        AND aai.ai_score = 5
        AND ar.published_at >= :weekStart::DATE
      ORDER BY ar.published_at DESC
      LIMIT 5
    `, { weekStart: weekStart.toISOString().slice(0, 10) });

    const topArticles = topArticleRows.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      oneLiner: r.one_liner ?? '',
      entityName: r.entity_name,
      categoryName: r.category_name,
      score: Number(r.score),
      date: new Date(r.date).toISOString().slice(0, 10),
      page: r.page,
    }));

    return {
      weekStart: new Date(latest.week_start).toISOString().slice(0, 10),
      weekEnd: new Date(latest.week_end).toISOString().slice(0, 10),
      treemap,
      topMomentumEntities,
      topArticles,
    };
  }
}
