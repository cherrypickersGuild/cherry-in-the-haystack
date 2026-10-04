import * as crypto from 'crypto'
import { Pool } from 'pg'

export interface RegistryRow {
  id: string
  status: 'active' | 'pending_review'
  prNumber: number | null
  prUrl: string | null
  generatedCode: string
}

// ─── Pool lifecycle ──────────────────────────────────────────────────────────

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString })
}

export async function closePool(pool: Pool): Promise<void> {
  await pool.end()
}

// ─── content.source ──────────────────────────────────────────────────────────

export async function getSourceByUrl(
  pool: Pool,
  url: string,
): Promise<{ id: string } | null> {
  const res = await pool.query(
    'SELECT id FROM content.source WHERE url = $1 LIMIT 1',
    [url],
  )
  if (res.rows.length === 0) return null
  return { id: res.rows[0].id as string }
}

export async function insertSource(
  pool: Pool,
  params: {
    id: string
    url: string
    sourceName: string
    sourceType: string
  },
): Promise<string> {
  // CRITICAL: content.source is a pre-existing table in cherry-in-the-haystack.
  // Verify its NOT NULL columns against the DDL before deploying. The fields used
  // here (id, url, source_name, source_type) are the minimum expected from the
  // YAML config schema. Additional required columns must be added if the DDL
  // mandates them.
  await pool.query(
    `INSERT INTO content.source (id, url, source_name, source_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (url) DO NOTHING`,
    [params.id, params.url, params.sourceName, params.sourceType],
  )
  return params.id
}

// ─── content.crawler_registry ────────────────────────────────────────────────

export async function getActiveOrPendingRegistry(
  pool: Pool,
  sourceId: string,
): Promise<RegistryRow | null> {
  const res = await pool.query(
    `SELECT id, status, pr_number, pr_url, generated_code
     FROM content.crawler_registry
     WHERE source_id = $1 AND status IN ('active', 'pending_review')
     ORDER BY created_at DESC LIMIT 1`,
    [sourceId],
  )
  if (res.rows.length === 0) return null
  const row = res.rows[0]
  return {
    id: row.id as string,
    status: row.status as 'active' | 'pending_review',
    prNumber: row.pr_number as number | null,
    prUrl: row.pr_url as string | null,
    generatedCode: row.generated_code as string,
  }
}

export async function updateRegistryWithPR(
  pool: Pool,
  registryId: string,
  prNumber: number,
  prUrl: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.crawler_registry
     SET pr_number = $2, pr_url = $3, updated_at = NOW()
     WHERE id = $1`,
    [registryId, prNumber, prUrl],
  )
}

export async function activateRegistry(
  pool: Pool,
  registryId: string,
  prMergedAt: Date,
): Promise<void> {
  await pool.query(
    `UPDATE content.crawler_registry
     SET status = 'active', pr_merged_at = $2, updated_at = NOW()
     WHERE id = $1`,
    [registryId, prMergedAt],
  )
}

// ─── content.crawler_registry — active crawlers ──────────────────────────────

export interface ActiveCrawlerRow {
  registryId: string
  sourceId: string
  sourceUrl: string
}

export async function getAllActiveRegistryCrawlers(
  pool: Pool,
): Promise<ActiveCrawlerRow[]> {
  const res = await pool.query(
    `SELECT r.id AS registry_id, r.source_id, s.url AS source_url
     FROM content.crawler_registry r
     JOIN content.source s ON s.id = r.source_id
     WHERE r.status = 'active'
     ORDER BY r.created_at ASC`,
  )
  return res.rows.map((row) => ({
    registryId: row.registry_id as string,
    sourceId: row.source_id as string,
    sourceUrl: row.source_url as string,
  }))
}

// ─── content.article_raw (Story 2.3) ─────────────────────────────────────────

export interface ArticleRawInsert {
  title: string
  content_raw: string
  published_at: string
  author: string
  url: string
  canonical_url: string
  representative_key: string
  representative_key_hash: Buffer
  content_hash: Buffer
}

export async function getExistingRepresentativeKeyHashes(
  pool: Pool,
  hashes: Buffer[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  const res = await pool.query(
    'SELECT representative_key_hash FROM content.article_raw WHERE representative_key_hash = ANY($1)',
    [hashes],
  )
  return new Set(res.rows.map((row) => (row.representative_key_hash as Buffer).toString('hex')))
}

export async function insertArticlesRaw(
  pool: Pool,
  sourceId: string,
  items: ArticleRawInsert[],
): Promise<void> {
  for (const item of items) {
    const id = crypto.randomUUID()
    await pool.query(
      `INSERT INTO content.article_raw
         (id, source_id, title, content_raw, published_at, author,
          url, canonical_url, representative_key, representative_key_hash, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING`,
      [id, sourceId, item.title, item.content_raw, item.published_at, item.author,
       item.url, item.canonical_url, item.representative_key, item.representative_key_hash, item.content_hash],
    )
  }
}

// ─── consecutive_failures (Story 2.3) ────────────────────────────────────────

export async function resetConsecutiveFailures(
  pool: Pool,
  sourceId: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.crawler_registry
     SET consecutive_failures = 0, updated_at = NOW()
     WHERE source_id = $1 AND status = 'active'`,
    [sourceId],
  )
}

export async function incrementConsecutiveFailures(
  pool: Pool,
  sourceId: string,
): Promise<number> {
  const res = await pool.query(
    `UPDATE content.crawler_registry
     SET consecutive_failures = consecutive_failures + 1, updated_at = NOW()
     WHERE source_id = $1 AND status = 'active'
     RETURNING consecutive_failures`,
    [sourceId],
  )
  return (res.rows[0]?.consecutive_failures as number) ?? 0
}

export async function deprecateRegistry(
  pool: Pool,
  registryId: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.crawler_registry
     SET status = 'deprecated', updated_at = NOW()
     WHERE id = $1`,
    [registryId],
  )
}

export async function hasDeprecatedRegistry(
  pool: Pool,
  sourceId: string,
): Promise<boolean> {
  const res = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM content.crawler_registry
       WHERE source_id = $1 AND status = 'deprecated'
     ) AS has_deprecated`,
    [sourceId],
  )
  return (res.rows[0]?.has_deprecated as boolean) ?? false
}

// ─── content.source stats (Story 2.3 AC4) ────────────────────────────────────

export async function resetSourceStats(
  pool: Pool,
  sourceId: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.source
     SET consecutive_failures = 0, last_success_at = NOW()
     WHERE id = $1`,
    [sourceId],
  )
}

export async function incrementSourceConsecutiveFailures(
  pool: Pool,
  sourceId: string,
): Promise<void> {
  await pool.query(
    `UPDATE content.source
     SET consecutive_failures = consecutive_failures + 1
     WHERE id = $1`,
    [sourceId],
  )
}

// ─── content.crawler_analysis — by source_id (Story 1.5 retry path) ──────────

export async function getCrawlerAnalysisBySourceId(
  pool: Pool,
  sourceId: string,
): Promise<{ id: string; analysisJson: Record<string, unknown> } | null> {
  const res = await pool.query(
    'SELECT id, analysis_json FROM content.crawler_analysis WHERE source_id = $1 LIMIT 1',
    [sourceId],
  )
  if (res.rows.length === 0) return null
  return {
    id: res.rows[0].id as string,
    analysisJson: res.rows[0].analysis_json as Record<string, unknown>,
  }
}
