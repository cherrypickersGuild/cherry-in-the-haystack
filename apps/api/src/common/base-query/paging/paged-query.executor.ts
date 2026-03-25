import { Knex } from 'knex';

export type PagedQueryParams = {
  countQuery: Knex.QueryBuilder;
  rowsQuery: Knex.QueryBuilder;
  offset: number;
  limit: number;
};

export type PagedQueryResult<TRow> = {
  total: number;
  rows: TRow[];
};

function resolveCountValue(countRow: unknown): number {
  if (!countRow || typeof countRow !== 'object') return 0;

  const row = countRow as Record<string, unknown>;
  const preferredKeys = ['total', 'count', 'cnt'];

  for (const preferredKey of preferredKeys) {
    if (preferredKey in row) {
      const n = Number(row[preferredKey]);
      if (Number.isFinite(n)) return n;
    }
  }

  const countLikeEntry = Object.entries(row).find(([key]) =>
    key.toLowerCase().includes('count'),
  );
  if (countLikeEntry) {
    const n = Number(countLikeEntry[1]);
    if (Number.isFinite(n)) return n;
  }

  for (const value of Object.values(row)) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

export async function executePagedQuery<TRow>(
  params: PagedQueryParams,
): Promise<PagedQueryResult<TRow>> {
  const { countQuery, rowsQuery, offset, limit } = params;

  const [countRow, rows] = await Promise.all([
    countQuery.first(),
    rowsQuery.clone().offset(offset).limit(limit),
  ]);

  return {
    total: resolveCountValue(countRow),
    rows: rows as TRow[],
  };
}
