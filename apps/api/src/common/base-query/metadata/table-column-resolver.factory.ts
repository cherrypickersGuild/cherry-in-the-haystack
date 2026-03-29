import { Knex } from 'knex';

import { TableColumnResolver } from './table-column.resolver';

const resolverCache = new WeakMap<Knex, TableColumnResolver>();

export function getTableColumnResolver(knex: Knex): TableColumnResolver {
  const cached = resolverCache.get(knex);
  if (cached) {
    return cached;
  }

  const created = new TableColumnResolver(knex);
  resolverCache.set(knex, created);
  return created;
}

export function clearTableColumnResolverCache(knex: Knex): void {
  resolverCache.delete(knex);
}
