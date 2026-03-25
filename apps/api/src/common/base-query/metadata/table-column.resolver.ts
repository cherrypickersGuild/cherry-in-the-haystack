import { Knex } from 'knex';

type TableColumnCache = {
  columns: Set<string>;
};

/**
 * information_schema.COLUMNS 기반 테이블 컬럼 메타데이터 resolver.
 * - 프로세스 메모리 캐시를 사용해 동일 테이블 재조회 비용을 줄인다.
 * - 스키마 조회 실패 시 null/false 반환으로 안전하게 폴백한다.
 */
export class TableColumnResolver {
  private readonly tableColumnCache = new Map<string, TableColumnCache>();
  private readonly firstColumnMatchCache = new Map<string, string | null>();

  constructor(private readonly knex: Knex) {}

  async resolveFirstExistingColumn(
    tableName: string,
    candidates: readonly string[],
  ): Promise<string | null> {
    const cacheKey = `${tableName}::${candidates.join('|')}`;
    const cached = this.firstColumnMatchCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const columns = await this.readTableColumns(tableName);
    if (!columns) {
      this.firstColumnMatchCache.set(cacheKey, null);
      return null;
    }

    for (const candidate of candidates) {
      if (columns.has(candidate)) {
        this.firstColumnMatchCache.set(cacheKey, candidate);
        return candidate;
      }
    }

    this.firstColumnMatchCache.set(cacheKey, null);
    return null;
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const columns = await this.readTableColumns(tableName);
    if (!columns) return false;
    return columns.has(columnName);
  }

  private async readTableColumns(
    tableName: string,
  ): Promise<Set<string> | null> {
    const normalizedTable = String(tableName ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedTable) return null;

    const cached = this.tableColumnCache.get(normalizedTable);
    if (cached) {
      return cached.columns;
    }

    try {
      const rows = await this.knex('information_schema.COLUMNS')
        .select<{ COLUMN_NAME: string }[]>('COLUMN_NAME')
        .whereRaw('TABLE_SCHEMA = DATABASE()')
        .andWhere('TABLE_NAME', normalizedTable);

      const columns = new Set(
        rows.map((r) => String(r.COLUMN_NAME)).filter(Boolean),
      );

      this.tableColumnCache.set(normalizedTable, { columns });
      return columns;
    } catch {
      return null;
    }
  }
}
