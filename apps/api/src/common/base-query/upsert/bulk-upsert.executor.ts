import { Knex } from 'knex';

type UpsertRow = Record<string, unknown>;

type UpsertDb = Knex | Knex.Transaction;

export type BulkUpsertRawOptions = {
  tableName: string;
  rows: UpsertRow[];
  updateClause: string;
  chunkSize?: number;
};

export type BulkUpsertOptions = {
  tableName: string;
  rows: UpsertRow[];
  updateColumns: string[];
  chunkSize?: number;
};

function chunkRows<T>(rows: T[], chunkSize: number): T[][] {
  const normalizedSize =
    Number.isFinite(chunkSize) && chunkSize > 0 ? Math.trunc(chunkSize) : 1000;

  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += normalizedSize) {
    chunks.push(rows.slice(i, i + normalizedSize));
  }
  return chunks;
}

function assertSqlIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${label} contains invalid identifier: ${value}`);
  }
}

function resolveColumns(rows: UpsertRow[]): string[] {
  const firstRow = rows[0] ?? {};
  const columns = Object.keys(firstRow);
  if (columns.length === 0) {
    throw new Error('rows must include at least one column');
  }

  for (const column of columns) {
    assertSqlIdentifier(column, 'columnName');
  }

  return columns;
}

function buildInsertBindings(rows: UpsertRow[], columns: string[]): unknown[] {
  const bindings: unknown[] = [];
  for (const row of rows) {
    for (const column of columns) {
      bindings.push(row[column]);
    }
  }
  return bindings;
}

function buildUpdateClause(updateColumns: string[]): string {
  if (!Array.isArray(updateColumns) || updateColumns.length === 0) {
    throw new Error('updateColumns must not be empty');
  }

  for (const column of updateColumns) {
    assertSqlIdentifier(column, 'updateColumn');
  }

  return updateColumns
    .map((column) => `${column} = VALUES(${column})`)
    .join(', ');
}

export async function executeBulkUpsertRaw(
  db: UpsertDb,
  options: BulkUpsertRawOptions,
): Promise<void> {
  const { tableName, rows, updateClause } = options;
  const chunkSize = options.chunkSize ?? 1000;

  if (!rows.length) return;

  assertSqlIdentifier(tableName, 'tableName');

  const columns = resolveColumns(rows);
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;

  for (const chunk of chunkRows(rows, chunkSize)) {
    if (!chunk.length) continue;

    const placeholders = chunk.map(() => rowPlaceholder).join(',\n');
    const bindings = buildInsertBindings(chunk, columns);

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    await db.raw(sql, bindings);
  }
}

export async function executeBulkUpsert(
  db: UpsertDb,
  options: BulkUpsertOptions,
): Promise<void> {
  const updateClause = buildUpdateClause(options.updateColumns);
  await executeBulkUpsertRaw(db, {
    tableName: options.tableName,
    rows: options.rows,
    updateClause,
    chunkSize: options.chunkSize,
  });
}
