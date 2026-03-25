export type SortDir = 'asc' | 'desc';

export type SortSpec<TField extends string = string> = {
  field: TField;
  dir: SortDir;
};

export type SortShorthandSpec<TField extends string = string> = {
  key: string;
  field: TField;
};

export type SortOrderClause = {
  column: string;
  dir: SortDir;
  nullsLast?: boolean;
};

export class SortDslParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SortDslParseError';
  }
}
