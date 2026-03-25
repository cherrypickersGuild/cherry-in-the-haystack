import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export type BoardMemoryQueryResult<TRow> = {
  total: number;
  rows: TRow[];
};

export type BoardMemoryJoinAdapter<
  TContext,
  TRaw,
  TRow,
  TQuery = Record<string, unknown>,
> = {
  key: (context: TContext) => string;
  ttlMs: number;
  loadRaw: (context: TContext) => Promise<TRaw>;
  buildRows: (raw: TRaw, context: TContext) => TRow[];
  queryRows: (
    rows: TRow[],
    query: TQuery,
    context: TContext,
  ) => BoardMemoryQueryResult<TRow>;
};

type MemoryDatasetEntry = {
  value: unknown;
  expiresAt: number;
  updatedAt: number;
};

type MemoryQueryResultEntry = {
  value: unknown;
  expiresAt: number;
  updatedAt: number;
};

@Injectable()
export class BoardMemoryJoinService {
  private readonly logger = new Logger(BoardMemoryJoinService.name);
  private readonly datasets = new Map<string, MemoryDatasetEntry>();
  private readonly buildInFlight = new Map<string, Promise<unknown>>();
  private readonly queryResults = new Map<string, MemoryQueryResultEntry>();
  private readonly redisPrefix =
    process.env.BOARD_MEMORY_DATASET_PREFIX ?? 'front:board:memory:dataset';
  private readonly buildLockPrefix =
    process.env.BOARD_MEMORY_BUILD_LOCK_PREFIX ?? 'front:board:memory:lock';
  private readonly buildLockTtlSeconds = Math.max(
    5,
    Number(process.env.BOARD_MEMORY_BUILD_LOCK_TTL_SECONDS ?? 120),
  );
  private readonly lockWaitMs = Math.max(
    100,
    Number(process.env.BOARD_MEMORY_LOCK_WAIT_MS ?? 8_000),
  );
  private readonly lockPollIntervalMs = Math.max(
    50,
    Number(process.env.BOARD_MEMORY_LOCK_POLL_INTERVAL_MS ?? 150),
  );
  private readonly queryResultTtlMs = Math.max(
    0,
    Number(process.env.BOARD_MEMORY_QUERY_RESULT_TTL_MS ?? 300_000),
  );

  constructor(private readonly redisService: RedisService) {}

  async run<TContext, TRaw, TRow, TQuery = Record<string, unknown>>(
    adapter: BoardMemoryJoinAdapter<TContext, TRaw, TRow, TQuery>,
    context: TContext,
    query: TQuery,
  ): Promise<BoardMemoryQueryResult<TRow>> {
    const key = adapter.key(context);
    const rows = await this.getOrBuildRows(adapter, context, key);
    const queryKey = this.buildQueryCacheKey(key, query);
    const cached =
      this.tryReadQueryResultFromL1<BoardMemoryQueryResult<TRow>>(queryKey);
    if (cached) {
      this.logEvent('hit_query_l1', key);
      return cached;
    }

    const result = adapter.queryRows(rows, query, context);
    this.setQueryResultToL1(queryKey, result);
    return result;
  }

  async prewarm<TContext, TRaw, TRow, TQuery = Record<string, unknown>>(
    adapter: BoardMemoryJoinAdapter<TContext, TRaw, TRow, TQuery>,
    context: TContext,
  ): Promise<{ key: string; rows: number }> {
    const key = adapter.key(context);
    const rows = await this.getOrBuildRows(adapter, context, key, true);
    return { key, rows: rows.length };
  }

  invalidateByPrefix(prefix: string): number {
    const normalized = (prefix ?? '').trim();
    if (!normalized) return 0;
    let removed = 0;
    for (const key of this.datasets.keys()) {
      if (!key.startsWith(normalized)) continue;
      this.datasets.delete(key);
      this.invalidateQueryResultsByDatasetKey(key);
      removed += 1;
    }
    this.invalidateQueryResultsByPrefix(normalized);
    void this.redisService
      .deleteByPrefix(this.toRedisDatasetKey(normalized))
      .catch((error) => {
        this.logger.warn(
          `[BoardMemoryJoin] redis invalidation failed prefix=${normalized}, error=${(error as Error)?.message ?? String(error)}`,
        );
      });
    return removed;
  }

  getDatasetMeta(prefix?: string): Array<{
    key: string;
    updatedAt: number;
    expiresAt: number;
    remainingMs: number;
  }> {
    const now = Date.now();
    const out: Array<{
      key: string;
      updatedAt: number;
      expiresAt: number;
      remainingMs: number;
    }> = [];
    const normalized = (prefix ?? '').trim();
    for (const [key, value] of this.datasets.entries()) {
      if (normalized && !key.startsWith(normalized)) continue;
      out.push({
        key,
        updatedAt: value.updatedAt,
        expiresAt: value.expiresAt,
        remainingMs: Math.max(0, value.expiresAt - now),
      });
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  private async getOrBuildRows<
    TContext,
    TRaw,
    TRow,
    TQuery = Record<string, unknown>,
  >(
    adapter: BoardMemoryJoinAdapter<TContext, TRaw, TRow, TQuery>,
    context: TContext,
    key: string,
    force = false,
  ): Promise<TRow[]> {
    const l1Rows = this.tryReadRowsFromL1<TRow>(key, force);
    if (l1Rows) {
      this.logEvent('hit_l1', key, { rows: l1Rows.length });
      return l1Rows;
    }

    const l2Rows = await this.tryReadRowsFromL2<TRow>(
      key,
      adapter.ttlMs,
      force,
    );
    if (l2Rows) {
      this.logEvent('hit_l2', key, { rows: l2Rows.length });
      return l2Rows;
    }

    const inFlight = this.buildInFlight.get(key);
    if (inFlight) {
      const rows = (await inFlight) as TRow[];
      this.logEvent('hit_inflight', key, { rows: rows.length });
      return rows;
    }

    const buildPromise = this.buildRowsWithLock(adapter, context, key);
    this.buildInFlight.set(key, buildPromise);
    try {
      return await buildPromise;
    } finally {
      this.buildInFlight.delete(key);
    }
  }

  private tryReadRowsFromL1<TRow>(key: string, force: boolean): TRow[] | null {
    if (force) return null;
    const now = Date.now();
    const cached = this.datasets.get(key);
    if (!cached || cached.expiresAt <= now) return null;
    return cached.value as TRow[];
  }

  private async tryReadRowsFromL2<TRow>(
    key: string,
    ttlMs: number,
    force: boolean,
  ): Promise<TRow[] | null> {
    if (force) return null;
    const redisCached = await this.readRowsFromRedis<TRow>(key).catch(
      () => null,
    );
    if (!redisCached) return null;
    this.setL1Rows(key, redisCached, ttlMs);
    return redisCached;
  }

  private async buildRowsWithLock<
    TContext,
    TRaw,
    TRow,
    TQuery = Record<string, unknown>,
  >(
    adapter: BoardMemoryJoinAdapter<TContext, TRaw, TRow, TQuery>,
    context: TContext,
    key: string,
  ): Promise<TRow[]> {
    this.logEvent('miss_build', key);
    const lockKey = this.toRedisLockKey(key);
    const lockToken = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const lockAcquired = await this.redisService.setNxEx(
      lockKey,
      lockToken,
      this.buildLockTtlSeconds,
    );

    if (!lockAcquired) {
      const waited = await this.waitForRowsFromRedis<TRow>(key, adapter.ttlMs);
      if (waited) return waited.rows;
    }

    const startedAt = Date.now();
    try {
      const raw = await adapter.loadRaw(context);
      const rows = adapter.buildRows(raw, context);
      await this.writeRowsToRedis(key, rows, adapter.ttlMs).catch((error) => {
        this.logger.warn(
          `[BoardMemoryJoin] redis write failed key=${key}, error=${(error as Error)?.message ?? String(error)}`,
        );
      });
      this.setL1Rows(key, rows, adapter.ttlMs);
      this.logEvent('build_done', key, {
        rows: rows.length,
        build_ms: Date.now() - startedAt,
      });
      return rows;
    } finally {
      if (lockAcquired) {
        await this.redisService
          .releaseIfValueMatches(lockKey, lockToken)
          .catch(() => undefined);
      }
    }
  }

  private async waitForRowsFromRedis<TRow>(
    key: string,
    ttlMs: number,
  ): Promise<{ rows: TRow[]; lockWaitMs: number } | null> {
    const waitStartedAt = Date.now();
    while (Date.now() - waitStartedAt < this.lockWaitMs) {
      await this.sleep(this.lockPollIntervalMs);
      const waitedRows = await this.readRowsFromRedis<TRow>(key).catch(
        () => null,
      );
      if (!waitedRows) continue;
      this.setL1Rows(key, waitedRows, ttlMs);
      const lockWaitMs = Date.now() - waitStartedAt;
      this.logEvent('hit_l2_after_wait', key, {
        rows: waitedRows.length,
        lock_wait_ms: lockWaitMs,
      });
      return { rows: waitedRows, lockWaitMs };
    }
    this.logEvent('lock_wait_timeout', key, { lock_wait_ms: this.lockWaitMs });
    return null;
  }

  private setL1Rows<TRow>(key: string, rows: TRow[], ttlMs: number) {
    this.datasets.set(key, {
      value: rows,
      updatedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
    this.invalidateQueryResultsByDatasetKey(key);
  }

  private tryReadQueryResultFromL1<T>(queryKey: string): T | null {
    if (this.queryResultTtlMs <= 0) return null;
    const now = Date.now();
    const cached = this.queryResults.get(queryKey);
    if (!cached || cached.expiresAt <= now) return null;
    return cached.value as T;
  }

  private setQueryResultToL1<T>(queryKey: string, value: T) {
    if (this.queryResultTtlMs <= 0) return;
    const now = Date.now();
    this.queryResults.set(queryKey, {
      value,
      updatedAt: now,
      expiresAt: now + this.queryResultTtlMs,
    });
  }

  private buildQueryCacheKey(queryDatasetKey: string, query: unknown): string {
    return `${queryDatasetKey}|${this.stableStringify(query)}`;
  }

  private invalidateQueryResultsByDatasetKey(datasetKey: string) {
    const prefix = `${datasetKey}|`;
    for (const key of this.queryResults.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.queryResults.delete(key);
    }
  }

  private invalidateQueryResultsByPrefix(datasetPrefix: string) {
    const prefix = `${datasetPrefix}`;
    for (const key of this.queryResults.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.queryResults.delete(key);
    }
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    const t = typeof value;
    if (t === 'number' || t === 'boolean' || t === 'bigint') {
      return String(value);
    }
    if (t === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableStringify(v)).join(',')}]`;
    }
    if (t === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return `{${keys
        .map((k) => `${JSON.stringify(k)}:${this.stableStringify(obj[k])}`)
        .join(',')}}`;
    }
    return JSON.stringify(String(value));
  }

  private async readRowsFromRedis<TRow>(key: string): Promise<TRow[] | null> {
    const cached = await this.redisService.get(this.toRedisDatasetKey(key));
    if (!Array.isArray(cached)) return null;
    return cached as TRow[];
  }

  private async writeRowsToRedis<TRow>(
    key: string,
    rows: TRow[],
    ttlMs: number,
  ) {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.redisService.set(this.toRedisDatasetKey(key), rows, ttlSeconds);
  }

  private toRedisDatasetKey(key: string): string {
    return `${this.redisPrefix}:${key}`;
  }

  private toRedisLockKey(key: string): string {
    return `${this.buildLockPrefix}:${key}`;
  }

  private async sleep(ms: number) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private logEvent(
    event:
      | 'hit_l1'
      | 'hit_query_l1'
      | 'hit_l2'
      | 'hit_inflight'
      | 'miss_build'
      | 'hit_l2_after_wait'
      | 'lock_wait_timeout'
      | 'build_done',
    key: string,
    meta?: Record<string, number | string | boolean>,
  ) {
    const pairs = Object.entries(meta ?? {})
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(', ');
    const suffix = pairs ? `, ${pairs}` : '';
    this.logger.log(`[BoardMemoryJoin] event=${event}, key=${key}${suffix}`);
  }
}
