-- Auto-News PostgreSQL Schema
-- This file is executed automatically on first database creation

-- Full-Text Search extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- articles: 크롤링된 아티클 저장 (핵심 테이블)
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
    id              SERIAL PRIMARY KEY,
    article_hash    VARCHAR(64) NOT NULL UNIQUE,
    source          VARCHAR(50) NOT NULL,
    list_name       VARCHAR(256) NOT NULL,
    category        VARCHAR(50),
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    content         TEXT,
    summary         TEXT,
    why_it_matters  TEXT,
    insights        JSONB,
    examples        JSONB,
    categories      JSONB,
    tags            JSONB,
    relevant_score  FLOAT,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notion_synced   BOOLEAN NOT NULL DEFAULT FALSE,
    notion_page_id  VARCHAR(64),
    search_vector   TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C')
    ) STORED
);

CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);
CREATE INDEX idx_articles_title_trgm ON articles USING GIN(title gin_trgm_ops);
CREATE INDEX idx_articles_source ON articles(source);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_published_at ON articles(published_at);
CREATE INDEX idx_articles_created_at ON articles(created_at);
CREATE INDEX idx_articles_notion_synced ON articles(notion_synced);

-- ============================================================
-- feed_configs: 피드 설정 (API로 런타임 CRUD 가능)
-- ============================================================
CREATE TABLE IF NOT EXISTS feed_configs (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(256) NOT NULL UNIQUE,
    url         TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'rss',
    category    VARCHAR(50),
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    count       INTEGER NOT NULL DEFAULT 3,
    config      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_configs_source_type ON feed_configs(source_type);
CREATE INDEX idx_feed_configs_enabled ON feed_configs(enabled);

-- ============================================================
-- job_runs: 배치 잡 실행 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS job_runs (
    id          SERIAL PRIMARY KEY,
    job_name    VARCHAR(100) NOT NULL,
    run_id      VARCHAR(256) NOT NULL UNIQUE,
    status      VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    stats       JSONB,
    error_msg   TEXT
);

CREATE INDEX idx_job_runs_job_name ON job_runs(job_name);
CREATE INDEX idx_job_runs_status ON job_runs(status);
CREATE INDEX idx_job_runs_started_at ON job_runs(started_at);

-- ============================================================
-- index_pages: Notion 페이지 인덱스 (MySQL에서 마이그레이션)
-- ============================================================
CREATE TABLE IF NOT EXISTS index_pages (
    id          SERIAL PRIMARY KEY,
    category    VARCHAR(256) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    index_id    VARCHAR(256) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, name)
);

-- ============================================================
-- patches: 마이그레이션 패치 추적
-- ============================================================
CREATE TABLE IF NOT EXISTS patches (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(256) NOT NULL UNIQUE,
    order_id    INTEGER NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Seed: 초기 피드 설정 데이터 (rss_feeds.py에서 마이그레이션)
-- ============================================================
INSERT INTO feed_configs (name, url, source_type, category, enabled, count, config) VALUES
    -- Category: Insights
    ('Reddit MachineLearning Feed', 'https://www.reddit.com/r/machinelearningnews/.rss', 'rss', 'insights', true, 3, NULL),
    ('AI Newsletter - elvis saravia', 'https://nlp.elvissaravia.com/feed', 'rss', 'insights', true, 3, NULL),
    ('MIT Technology Review', 'https://www.technologyreview.com/feed/', 'rss', 'insights', true, 3, NULL),
    ('Ben''s Bites', 'https://www.bensbites.com/feed', 'rss', 'insights', true, 3, NULL),
    -- Category: Business
    ('Ethan Mollick (AI & Education)', 'https://www.oneusefulthing.org/feed', 'rss', 'business', true, 3, NULL),
    ('Harvard Business Review (AI)', 'http://feeds.hbr.org/harvardbusiness', 'rss', 'business', true, 3, NULL),
    ('The Sequence', 'https://thesequence.substack.com/feed', 'rss', 'business', true, 3, NULL),
    -- Category: Practical
    ('Latent Space (Swyx)', 'https://latent.space/feed', 'rss', 'practical', true, 3, NULL),
    ('Ahead of AI (Sebastian Raschka)', 'https://magazine.sebastianraschka.com/feed', 'rss', 'practical', true, 3, NULL),
    ('Anthropic News', 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml', 'rss', 'practical', true, 3, NULL),
    ('Dev.to (Engineering)', 'https://dev.to/feed/tag/ai', 'rss', 'practical', true, 5, NULL),
    -- Category: Big Tech
    ('OpenAI Blog', 'https://openai.com/blog/rss.xml', 'rss', 'big_tech', true, 3, NULL),
    ('Google AI Blog', 'http://googleaiblog.blogspot.com/atom.xml', 'rss', 'big_tech', true, 3, NULL),
    -- API Sources
    ('HackerNews (AI)', 'https://hacker-news.firebaseio.com/v0', 'api_hackernews', 'insights', true, 5,
     '{"keywords": ["AI agent", "MCP", "LLM", "Claude", "OpenAI", "Gemini", "Model Context Protocol"]}'),
    ('Dev.to API', 'https://dev.to/api/articles', 'api_devto', 'practical', true, 3,
     '{"tags": ["ai", "agents", "llm", "machinelearning", "mcp", "business", "use-case"]}')
ON CONFLICT (name) DO NOTHING;
