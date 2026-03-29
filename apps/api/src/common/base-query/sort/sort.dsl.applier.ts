import { Knex } from 'knex';
import { SortOrderClause, SortSpec } from './sort.dsl.types';

export type SortApplyOptions<TField extends string> = {
  alias: string;
  sortSpecs: Array<SortSpec<TField>>;
  resolveColumn: (field: TField, alias: string) => string;
  defaultOrder: SortOrderClause[];
  noField?: TField;
  noColumn?: string;
  tiebreakerColumn?: string;
  includeNullsLastForExplicitSort?: boolean;
};

export type SortWindowSqlOptions<TField extends string> = Omit<
  SortApplyOptions<TField>,
  'noColumn'
>;

function appendOrderClause(qb: Knex.QueryBuilder, clause: SortOrderClause) {
  if (clause.nullsLast) {
    qb.orderByRaw(`CASE WHEN ${clause.column} IS NULL THEN 1 ELSE 0 END ASC`);
  }
  qb.orderBy(clause.column, clause.dir);
}

function buildOrderSqlClauses(clauses: SortOrderClause[]): string[] {
  const out: string[] = [];
  for (const clause of clauses) {
    if (clause.nullsLast) {
      out.push(`CASE WHEN ${clause.column} IS NULL THEN 1 ELSE 0 END ASC`);
    }
    out.push(`${clause.column} ${clause.dir.toUpperCase()}`);
  }
  return out;
}

export function applySortOrderBy<TField extends string>(
  qb: Knex.QueryBuilder,
  options: SortApplyOptions<TField>,
): void {
  const {
    alias,
    sortSpecs,
    resolveColumn,
    defaultOrder,
    noField,
    noColumn,
    tiebreakerColumn,
    includeNullsLastForExplicitSort = true,
  } = options;

  if (sortSpecs.length < 1) {
    defaultOrder.forEach((clause) => appendOrderClause(qb, clause));
    if (tiebreakerColumn) {
      qb.orderBy(tiebreakerColumn, 'asc');
    }
    return;
  }

  for (const spec of sortSpecs) {
    if (noField && spec.field === noField) {
      if (noColumn) qb.orderBy(noColumn, spec.dir);
      continue;
    }

    const column = resolveColumn(spec.field, alias);
    if (includeNullsLastForExplicitSort) {
      qb.orderByRaw(`CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END ASC`);
    }
    qb.orderBy(column, spec.dir);
  }

  if (tiebreakerColumn) {
    qb.orderBy(tiebreakerColumn, 'asc');
  }
}

export function buildSortWindowOrderSql<TField extends string>(
  options: SortWindowSqlOptions<TField>,
): string {
  const {
    alias,
    sortSpecs,
    resolveColumn,
    defaultOrder,
    noField,
    tiebreakerColumn,
    includeNullsLastForExplicitSort = true,
  } = options;

  const explicitSpecs = noField
    ? sortSpecs.filter((spec) => spec.field !== noField)
    : [...sortSpecs];

  if (explicitSpecs.length < 1) {
    const defaults = buildOrderSqlClauses(defaultOrder);
    if (tiebreakerColumn) defaults.push(`${tiebreakerColumn} ASC`);
    return defaults.join(', ');
  }

  const clauses: string[] = [];
  for (const spec of explicitSpecs) {
    const column = resolveColumn(spec.field, alias);
    if (includeNullsLastForExplicitSort) {
      clauses.push(`CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END ASC`);
    }
    clauses.push(`${column} ${spec.dir.toUpperCase()}`);
  }

  if (tiebreakerColumn) {
    clauses.push(`${tiebreakerColumn} ASC`);
  }

  return clauses.join(', ');
}
