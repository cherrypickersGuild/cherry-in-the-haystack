-- ============================================================
-- Stage 6 — Snapshot Build (UI Rendering)
-- Cherry Platform Staged Mock Data
-- Prerequisites: Stages 0-5 applied
-- Week range: 2026-03-31 (Mon) to 2026-04-06 (Sun)
-- Builds all snapshot tables from content tables via aggregate queries.
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_user_id    UUID := current_setting('cherry.seed_user_id')::UUID;
    v_week_start DATE := '2026-03-31';
    v_week_end   DATE := '2026-04-06';
    v_page       content.entity_page_enum;
    v_page_arr   content.entity_page_enum[] := ARRAY[
        'MODEL_UPDATES', 'PAPER_BENCHMARK', 'FRAMEWORKS', 'TOOLS',
        'SHARED_RESOURCES', 'CASE_STUDIES', 'REGULATIONS',
        'BIG_TECH_TRENDS', 'THIS_WEEKS_POSTS'
    ]::content.entity_page_enum[];
    v_articles   JSONB;
    v_art_count  INT;
    v_treemap    JSONB;
    v_trending   JSONB;
    v_topics     JSONB;
    v_ranked     JSONB;
    v_spotlight  JSONB;
    v_areas      JSONB;
    v_stat_date  DATE;
    v_cnt        INT;
    v_hi_cnt     INT;
    v_uuid_base  TEXT;
    v_idx        INT := 0;
    v_total_week INT;
    v_score5_cnt INT;
    v_entity_cnt INT;
    rec          RECORD;
BEGIN

-- ============================================================
-- 1. platform_weekly_stat (1 row)
-- ============================================================
-- Count articles in the week
SELECT count(*) INTO v_total_week
FROM content.article_raw ar
WHERE ar.published_at >= v_week_start::TIMESTAMPTZ
  AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
  AND ar.representative_key LIKE 'seed-%';

-- Count score-5 items
SELECT count(*) INTO v_score5_cnt
FROM content.user_article_ai_state aai
JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
JOIN content.article_raw ar ON ar.id = uas.article_raw_id
WHERE aai.ai_score = 5
  AND ar.published_at >= v_week_start::TIMESTAMPTZ
  AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
  AND ar.representative_key LIKE 'seed-%';

-- Build treemap distribution (article count per page)
SELECT jsonb_agg(jsonb_build_object(
    'page', sub.page,
    'count', sub.cnt,
    'ratio', round(sub.cnt::NUMERIC / GREATEST(v_total_week, 1) * 100, 1)
) ORDER BY sub.cnt DESC)
INTO v_treemap
FROM (
    SELECT aai.representative_entity_page AS page, count(*) AS cnt
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
      AND ar.representative_key LIKE 'seed-%'
    GROUP BY aai.representative_entity_page
) sub;

-- Build trending keywords from ai_tags_json
SELECT jsonb_agg(jsonb_build_object('keyword', sub.kw, 'count', sub.cnt) ORDER BY sub.cnt DESC)
INTO v_trending
FROM (
    SELECT tag->>'value' AS kw, count(*) AS cnt
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id,
    LATERAL jsonb_array_elements(aai.ai_tags_json) AS tag
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
      AND ar.representative_key LIKE 'seed-%'
      AND tag->>'kind' = 'KEYWORD'
    GROUP BY tag->>'value'
    ORDER BY cnt DESC
    LIMIT 20
) sub;

-- Covered topics
SELECT jsonb_agg(DISTINCT jsonb_build_object('page', aai.representative_entity_page::TEXT))
INTO v_topics
FROM content.user_article_ai_state aai
JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
JOIN content.article_raw ar ON ar.id = uas.article_raw_id
WHERE aai.ai_status = 'SUCCESS'
  AND ar.published_at >= v_week_start::TIMESTAMPTZ
  AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
  AND ar.representative_key LIKE 'seed-%';

-- Count distinct entities this week
SELECT count(DISTINCT aai.representative_entity_id) INTO v_entity_cnt
FROM content.user_article_ai_state aai
JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
JOIN content.article_raw ar ON ar.id = uas.article_raw_id
WHERE aai.ai_status = 'SUCCESS'
  AND ar.published_at >= v_week_start::TIMESTAMPTZ
  AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
  AND ar.representative_key LIKE 'seed-%';

INSERT INTO snapshot.platform_weekly_stat (
    id, week_start, week_end,
    items_this_week, items_delta_vs_last_week,
    topics_covered_count, covered_topics_json,
    new_keywords_count, new_keywords_mom_rate, new_keywords_json,
    trending_keywords_json,
    score_5_items_count,
    treemap_distribution_json
) VALUES (
    '0195f300-d001-7000-8000-000000000001',
    v_week_start, v_week_end,
    v_total_week, 0,
    COALESCE(jsonb_array_length(v_topics), 0), COALESCE(v_topics, '[]'::JSONB),
    5, 0.15, '["mcp","agent","rag","fine-tuning","benchmark"]'::JSONB,
    COALESCE(v_trending, '[]'::JSONB),
    v_score5_cnt,
    COALESCE(v_treemap, '[]'::JSONB)
);

-- ============================================================
-- 2. entity_page_weekly_list (9 rows, one per page)
-- ============================================================
FOREACH v_page IN ARRAY v_page_arr LOOP
    v_idx := v_idx + 1;

    SELECT jsonb_agg(jsonb_build_object(
        'article_raw_id', ar.id,
        'title', ar.title,
        'url', ar.url,
        'published_at', ar.published_at,
        'entity_name', aai.representative_entity_name,
        'category_name', aai.representative_entity_category_name,
        'ai_score', aai.ai_score,
        'ai_summary', aai.ai_summary,
        'impact_score', uas.impact_score,
        'is_high_impact', uas.is_high_impact
    ) ORDER BY ar.published_at DESC),
    count(*)
    INTO v_articles, v_art_count
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND aai.representative_entity_page = v_page
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
      AND ar.representative_key LIKE 'seed-%';

    INSERT INTO snapshot.entity_page_weekly_list (
        id, entity_page, week_start, week_end,
        article_count, articles_json,
        is_published, published_at
    ) VALUES (
        ('0195f300-d010-7000-8000-00000000000' || v_idx::TEXT)::UUID,
        v_page, v_week_start, v_week_end,
        COALESCE(v_art_count, 0),
        COALESCE(v_articles, '[]'::JSONB),
        TRUE, CURRENT_TIMESTAMP
    );
END LOOP;

-- ============================================================
-- 3. user_entity_page_weekly_list (9 rows, one per page per user)
-- ============================================================
v_idx := 0;
FOREACH v_page IN ARRAY v_page_arr LOOP
    v_idx := v_idx + 1;

    SELECT jsonb_agg(jsonb_build_object(
        'user_article_state_id', uas.id,
        'article_raw_id', ar.id,
        'title', ar.title,
        'url', ar.url,
        'published_at', ar.published_at,
        'entity_name', aai.representative_entity_name,
        'category_name', aai.representative_entity_category_name,
        'ai_score', aai.ai_score,
        'ai_summary', aai.ai_summary,
        'impact_score', uas.impact_score,
        'is_high_impact', uas.is_high_impact,
        'is_hidden', uas.is_hidden
    ) ORDER BY ar.published_at DESC),
    count(*)
    INTO v_articles, v_art_count
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND aai.representative_entity_page = v_page
      AND uas.user_id = v_user_id
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
      AND ar.representative_key LIKE 'seed-%';

    INSERT INTO snapshot.user_entity_page_weekly_list (
        id, user_id, entity_page, week_start, week_end,
        article_count, articles_json, generation_status
    ) VALUES (
        ('0195f300-d020-7000-8000-00000000000' || v_idx::TEXT)::UUID,
        v_user_id, v_page, v_week_start, v_week_end,
        COALESCE(v_art_count, 0),
        COALESCE(v_articles, '[]'::JSONB),
        'DONE'
    );
END LOOP;

-- ============================================================
-- 4. user_weekly_stat (1 row)
-- ============================================================
INSERT INTO snapshot.user_weekly_stat (
    id, user_id, week_start, week_end,
    items_this_week, items_delta_vs_last_week,
    topics_covered_count, covered_topics_json,
    new_keywords_count, new_keywords_mom_rate, new_keywords_json,
    trending_keywords_json,
    score_5_items_count,
    treemap_distribution_json
) VALUES (
    '0195f300-d030-7000-8000-000000000001',
    v_user_id, v_week_start, v_week_end,
    v_total_week, 0,
    COALESCE(jsonb_array_length(v_topics), 0), COALESCE(v_topics, '[]'::JSONB),
    5, 0.15, '["mcp","agent","rag","fine-tuning","benchmark"]'::JSONB,
    COALESCE(v_trending, '[]'::JSONB),
    v_score5_cnt,
    COALESCE(v_treemap, '[]'::JSONB)
);

-- ============================================================
-- 5. user_daily_stat (one row per day with articles, week range only)
-- ============================================================
v_idx := 0;
FOR rec IN (
    SELECT
        ar.published_at::DATE AS stat_date,
        count(*) AS cnt,
        count(*) FILTER (WHERE uas.is_high_impact = TRUE) AS hi_cnt,
        jsonb_agg(DISTINCT jsonb_build_object('page', aai.representative_entity_page::TEXT)) AS areas
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id AND uas.user_id = v_user_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.representative_key LIKE 'seed-%'
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
    GROUP BY ar.published_at::DATE
    ORDER BY ar.published_at::DATE
)
LOOP
    v_idx := v_idx + 1;
    INSERT INTO snapshot.user_daily_stat (
        id, user_id, stat_date,
        new_article_count, new_high_impact_count,
        areas_changed_json
    ) VALUES (
        ('0195f300-d04' || lpad(to_hex(v_idx), 1, '0') || '-7000-8000-' || lpad(to_hex(v_idx), 12, '0'))::UUID,
        v_user_id, rec.stat_date,
        rec.cnt, rec.hi_cnt,
        rec.areas
    );
END LOOP;

-- ============================================================
-- 6. user_entity_daily_stat (one row per entity per day, week range only)
-- ============================================================
v_idx := 0;
FOR rec IN (
    SELECT
        ar.published_at::DATE AS stat_date,
        aai.representative_entity_id AS entity_id,
        count(*) AS cnt,
        count(*) FILTER (WHERE uas.is_high_impact = TRUE) AS hi_cnt,
        sum(uas.impact_score) AS score_sum,
        avg(uas.impact_score) AS score_avg,
        sum(uas.impact_score * aai.ai_score) AS weighted_score
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id AND uas.user_id = v_user_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.representative_key LIKE 'seed-%'
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
    GROUP BY ar.published_at::DATE, aai.representative_entity_id
    ORDER BY ar.published_at::DATE, aai.representative_entity_id
)
LOOP
    v_idx := v_idx + 1;
    INSERT INTO snapshot.user_entity_daily_stat (
        id, user_id, stat_date, tracked_entity_id,
        article_count, high_impact_count,
        score_sum, score_avg, weighted_score
    ) VALUES (
        ('0195f300-d05' || lpad((v_idx / 256)::TEXT, 1, '0') || '-7000-8000-' || lpad(to_hex(v_idx), 12, '0'))::UUID,
        v_user_id, rec.stat_date, rec.entity_id,
        rec.cnt, rec.hi_cnt,
        rec.score_sum, round(rec.score_avg, 4), rec.weighted_score
    );
END LOOP;

-- ============================================================
-- 7. user_entity_weekly_stat (1 row — entity leaderboard)
-- ============================================================
-- Build ranked entity JSON (top entities by article count in the week)
SELECT jsonb_agg(jsonb_build_object(
    'rank', sub.rn,
    'tracked_entity_id', sub.entity_id,
    'entity_name', sub.entity_name,
    'article_count', sub.cnt,
    'avg_score', sub.avg_score,
    'total_impact', sub.total_impact
) ORDER BY sub.rn)
INTO v_ranked
FROM (
    SELECT
        row_number() OVER (ORDER BY count(*) DESC, avg(uas.impact_score) DESC) AS rn,
        aai.representative_entity_id AS entity_id,
        aai.representative_entity_name AS entity_name,
        count(*) AS cnt,
        round(avg(aai.ai_score), 2) AS avg_score,
        round(sum(uas.impact_score), 2) AS total_impact
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id AND uas.user_id = v_user_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
      AND ar.representative_key LIKE 'seed-%'
    GROUP BY aai.representative_entity_id, aai.representative_entity_name
) sub;

-- Spotlight: top entity details
SELECT jsonb_build_object(
    'tracked_entity_id', sub.entity_id,
    'entity_name', sub.entity_name,
    'article_count', sub.cnt,
    'avg_score', sub.avg_score,
    'reason', 'Most mentioned entity this week'
)
INTO v_spotlight
FROM (
    SELECT
        aai.representative_entity_id AS entity_id,
        aai.representative_entity_name AS entity_name,
        count(*) AS cnt,
        round(avg(aai.ai_score), 2) AS avg_score
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id AND uas.user_id = v_user_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.published_at >= v_week_start::TIMESTAMPTZ
      AND ar.published_at < (v_week_end + 1)::TIMESTAMPTZ
      AND ar.representative_key LIKE 'seed-%'
    GROUP BY aai.representative_entity_id, aai.representative_entity_name
    ORDER BY count(*) DESC
    LIMIT 1
) sub;

INSERT INTO snapshot.user_entity_weekly_stat (
    id, user_id, week_start, week_end,
    items_count, tracked_entity_count,
    ranking_metric_label,
    ranked_entity_json,
    spotlight_json
) VALUES (
    '0195f300-d060-7000-8000-000000000001',
    v_user_id, v_week_start, v_week_end,
    v_total_week, v_entity_cnt,
    'article_count',
    COALESCE(v_ranked, '[]'::JSONB),
    v_spotlight
);

-- ============================================================
-- 8. keyword_daily_stat (keywords from ai_tags_json by day)
-- ============================================================
v_idx := 0;
FOR rec IN (
    SELECT
        ar.published_at::DATE AS stat_date,
        tag->>'value' AS keyword,
        count(*) AS mention_count
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id,
    LATERAL jsonb_array_elements(aai.ai_tags_json) AS tag
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.representative_key LIKE 'seed-%'
      AND tag->>'kind' = 'KEYWORD'
    GROUP BY ar.published_at::DATE, tag->>'value'
    ORDER BY ar.published_at::DATE, count(*) DESC
)
LOOP
    v_idx := v_idx + 1;
    INSERT INTO snapshot.keyword_daily_stat (
        id, keyword, stat_date, mention_count, is_new
    ) VALUES (
        ('0195f300-d07' || lpad((v_idx / 256)::TEXT, 1, '0') || '-7000-8000-' || lpad(to_hex(v_idx), 12, '0'))::UUID,
        rec.keyword, rec.stat_date, rec.mention_count,
        FALSE
    );
END LOOP;

-- Mark some keywords as "new" (first seen in this week)
UPDATE snapshot.keyword_daily_stat kds
SET is_new = TRUE
WHERE kds.stat_date >= v_week_start
  AND kds.stat_date <= v_week_end
  AND kds.id IN (
    SELECT DISTINCT ON (kds2.keyword) kds2.id
    FROM snapshot.keyword_daily_stat kds2
    WHERE kds2.stat_date >= v_week_start
      AND kds2.stat_date <= v_week_end
    ORDER BY kds2.keyword, kds2.stat_date ASC
    LIMIT 5
  );

-- ============================================================
-- 9. entity_stat (one row per entity per day — keyword mentions)
-- ============================================================
v_idx := 0;
FOR rec IN (
    SELECT
        ar.published_at::DATE AS stat_date,
        aai.representative_entity_id AS entity_id,
        count(*) AS mentions
    FROM content.user_article_ai_state aai
    JOIN content.user_article_state uas ON uas.id = aai.user_article_state_id
    JOIN content.article_raw ar ON ar.id = uas.article_raw_id
    WHERE aai.ai_status = 'SUCCESS'
      AND ar.representative_key LIKE 'seed-%'
    GROUP BY ar.published_at::DATE, aai.representative_entity_id
    ORDER BY ar.published_at::DATE, aai.representative_entity_id
)
LOOP
    v_idx := v_idx + 1;
    INSERT INTO snapshot.entity_stat (
        id, tracked_entity_id, stat_date,
        keyword_mentions
    ) VALUES (
        ('0195f300-d08' || lpad((v_idx / 256)::TEXT, 1, '0') || '-7000-8000-' || lpad(to_hex(v_idx), 12, '0'))::UUID,
        rec.entity_id, rec.stat_date,
        rec.mentions
    );
END LOOP;

RAISE NOTICE 'Stage 6: Snapshot build complete.';
END $$;

COMMIT;
