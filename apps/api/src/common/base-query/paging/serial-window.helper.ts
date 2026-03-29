export type SerialWindowSqlOptions = {
  orderBySql: string;
  alias?: string;
};

export function buildSerialWindowSql(options: SerialWindowSqlOptions): string {
  const { orderBySql, alias = 'serial_no' } = options;
  return `ROW_NUMBER() OVER (ORDER BY ${orderBySql}) AS ${alias}`;
}
