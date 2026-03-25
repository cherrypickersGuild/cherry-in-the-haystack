import { Knex } from 'knex';
import { NumericFilterSpec } from './filter.dsl.types';

export function applyNumericFilter(
  qb: Knex.QueryBuilder,
  column: string,
  filter: NumericFilterSpec,
): void {
  if (filter.kind === 'single') {
    if (filter.op === 'gte') qb.andWhere(column, '>=', filter.value);
    if (filter.op === 'lte') qb.andWhere(column, '<=', filter.value);
    if (filter.op === 'gt') qb.andWhere(column, '>', filter.value);
    if (filter.op === 'lt') qb.andWhere(column, '<', filter.value);
    return;
  }

  qb.andWhere(
    column,
    filter.lower.op === 'gte' ? '>=' : '>',
    filter.lower.value,
  );
  qb.andWhere(
    column,
    filter.upper.op === 'lte' ? '<=' : '<',
    filter.upper.value,
  );
}

export function applyNumericFiltersByMap(
  qb: Knex.QueryBuilder,
  fieldToColumnMap: Record<string, string>,
  filters: Record<string, NumericFilterSpec | undefined>,
): void {
  Object.entries(filters).forEach(([field, filter]) => {
    if (!filter) return;
    const column = fieldToColumnMap[field];
    if (!column) return;
    applyNumericFilter(qb, column, filter);
  });
}
