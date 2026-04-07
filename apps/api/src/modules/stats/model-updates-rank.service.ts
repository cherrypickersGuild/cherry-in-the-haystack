import { Inject, Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';

@Injectable()
export class ModelUpdatesRankService {
  private readonly logger = new Logger(ModelUpdatesRankService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
  ) {}

  /**
   * 오늘 기준 MODEL_UPDATES 카테고리 순위 집계
   * - 이번 7일 vs 이전 7일 기사 수 비교
   * - 카테고리 내 top 2 엔터티 포함
   * - snapshot.model_updates_weekly_rank UPSERT
   */
  async buildDailyRank(): Promise<{ upserted: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const statDate = today.toISOString().slice(0, 10);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6);

    // 이번 7일 카테고리별 기사 수 + top 2 엔터티
    const currentRows = await this.knex.raw<{ rows: any[] }>(`
      WITH entity_counts AS (
        SELECT
          aai.representative_entity_id          AS entity_id,
          aai.representative_entity_name        AS entity_name,
          aai.representative_entity_category_id AS category_id,
          COUNT(DISTINCT uas.article_raw_id)    AS cnt
        FROM content.user_article_ai_state aai
        JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
        JOIN content.article_raw ar ON ar.id = uas.article_raw_id
        WHERE aai.representative_entity_page = 'MODEL_UPDATES'
          AND aai.ai_status = 'SUCCESS'
          AND ar.published_at >= :weekStart::DATE
          AND ar.published_at < :weekEnd::DATE + INTERVAL '1 day'
        GROUP BY
          aai.representative_entity_id,
          aai.representative_entity_name,
          aai.representative_entity_category_id
      ),
      ranked_entities AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY cnt DESC) AS rn
        FROM entity_counts
      ),
      top_entities AS (
        SELECT
          category_id,
          jsonb_agg(
            jsonb_build_object('id', entity_id, 'name', entity_name, 'article_count', cnt)
            ORDER BY cnt DESC
          ) AS top_entities_json
        FROM ranked_entities
        WHERE rn <= 2
        GROUP BY category_id
      ),
      category_totals AS (
        SELECT
          ec.category_id,
          ec2.name        AS category_name,
          SUM(ec.cnt)     AS article_count
        FROM entity_counts ec
        JOIN content.entity_category ec2 ON ec2.id = ec.category_id
        GROUP BY ec.category_id, ec2.name
      )
      SELECT
        ct.category_id,
        ct.category_name,
        ct.article_count,
        COALESCE(te.top_entities_json, '[]'::JSONB) AS top_entities_json,
        ROW_NUMBER() OVER (ORDER BY ct.article_count DESC) AS rank
      FROM category_totals ct
      LEFT JOIN top_entities te ON te.category_id = ct.category_id
      ORDER BY ct.article_count DESC
    `, { weekStart: weekStart.toISOString().slice(0, 10), weekEnd: statDate });

    // 이전 7일 카테고리별 기사 수
    const prevRows = await this.knex.raw<{ rows: any[] }>(`
      SELECT
        ec.id   AS category_id,
        COUNT(DISTINCT uas.article_raw_id) AS article_count
      FROM content.entity_category ec
      JOIN content.tracked_entity_placement tep
        ON tep.entity_category_id = ec.id
       AND tep.entity_page = 'MODEL_UPDATES'
       AND tep.revoked_at IS NULL
      JOIN content.tracked_entity te ON te.id = tep.tracked_entity_id
      JOIN content.user_article_state uas ON uas.representative_entity_id = te.id
      JOIN content.article_raw ar ON ar.id = uas.article_raw_id
        AND ar.published_at >= :prevWeekStart
        AND ar.published_at <= :prevWeekEnd
      WHERE ec.entity_page = 'MODEL_UPDATES'
      GROUP BY ec.id
    `, {
      prevWeekStart: prevWeekStart.toISOString().slice(0, 10),
      prevWeekEnd: prevWeekEnd.toISOString().slice(0, 10),
    });

    const prevMap = new Map<string, number>(
      prevRows.rows.map((r) => [r.category_id, Number(r.article_count)]),
    );

    // 이전 순위 조회 (어제 stat)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevRankRows = await this.knex('snapshot.model_updates_weekly_rank')
      .where('stat_date', yesterday.toISOString().slice(0, 10))
      .select('entity_category_id', 'rank');
    const prevRankMap = new Map<string, number>(
      prevRankRows.map((r) => [r.entity_category_id, r.rank]),
    );

    let upserted = 0;

    for (let i = 0; i < currentRows.rows.length; i++) {
      const row = currentRows.rows[i];
      const rank = Number(row.rank);
      const articleCount = Number(row.article_count);
      const prevArticleCount = prevMap.get(row.category_id) ?? 0;
      const prevRank = prevRankMap.get(row.category_id) ?? null;

      const changePct =
        prevArticleCount === 0
          ? null
          : Number((((articleCount - prevArticleCount) / prevArticleCount) * 100).toFixed(1));

      // top 2 엔터티만
      const topEntities = (row.top_entities_json ?? []).slice(0, 2);

      await this.knex.raw(`
        INSERT INTO snapshot.model_updates_weekly_rank
          (id, stat_date, week_start, week_end, entity_category_id,
           rank, prev_rank, article_count, prev_article_count, change_pct, top_entities_json)
        VALUES
          (gen_random_uuid(), :statDate, :weekStart, :weekEnd, :categoryId,
           :rank, :prevRank, :articleCount, :prevArticleCount, :changePct, :topEntities::JSONB)
        ON CONFLICT (stat_date, entity_category_id) DO UPDATE SET
          rank               = EXCLUDED.rank,
          prev_rank          = EXCLUDED.prev_rank,
          article_count      = EXCLUDED.article_count,
          prev_article_count = EXCLUDED.prev_article_count,
          change_pct         = EXCLUDED.change_pct,
          top_entities_json  = EXCLUDED.top_entities_json,
          updated_at         = NOW()
      `, {
        statDate,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: statDate,
        categoryId: row.category_id,
        rank,
        prevRank,
        articleCount,
        prevArticleCount,
        changePct,
        topEntities: JSON.stringify(topEntities),
      });

      upserted++;
    }

    this.logger.log(`buildDailyRank done — stat_date: ${statDate}, upserted: ${upserted}`);
    return { upserted };
  }

  async getLatestRank(): Promise<{
    statDate: string;
    weekStart: string;
    weekEnd: string;
    ranks: any[];
    risingStars: any[];
  }> {
    const latest = await this.knex('snapshot.model_updates_weekly_rank')
      .orderBy('stat_date', 'desc')
      .limit(1)
      .first('stat_date', 'week_start', 'week_end');

    if (!latest) return { statDate: '', weekStart: '', weekEnd: '', ranks: [], risingStars: [] };

    const rows = await this.knex('snapshot.model_updates_weekly_rank as r')
      .where('r.stat_date', latest.stat_date)
      .orderBy('r.rank', 'asc')
      .select(
        'r.rank',
        'r.prev_rank',
        'r.article_count',
        'r.prev_article_count',
        'r.change_pct',
        'r.top_entities_json',
        this.knex.raw(`ec.name AS category_name`),
      )
      .join('content.entity_category as ec', 'ec.id', 'r.entity_category_id');

    // 라이징 스타: 신규 진입(NEW) 또는 change_pct 상위 2개
    const risingStars = [
      // 신규 진입
      ...rows.filter((r) => r.prev_rank === null),
      // 전주 대비 상승률 상위 (신규 제외)
      ...rows
        .filter((r) => r.prev_rank !== null && r.change_pct !== null && Number(r.change_pct) > 0)
        .sort((a, b) => Number(b.change_pct) - Number(a.change_pct)),
    ]
      .filter((v, i, arr) => arr.findIndex((x) => x.category_name === v.category_name) === i) // 중복 제거
      .slice(0, 2)
      .map((r) => ({
        categoryName: r.category_name,
        isNew: r.prev_rank === null,
        changePct: r.change_pct,
        articleCount: r.article_count,
        topEntities: r.top_entities_json,
      }));

    return {
      statDate: new Date(latest.stat_date).toISOString().slice(0, 10),
      weekStart: new Date(latest.week_start).toISOString().slice(0, 10),
      weekEnd: new Date(latest.week_end).toISOString().slice(0, 10),
      ranks: rows,
      risingStars,
    };
  }
}
