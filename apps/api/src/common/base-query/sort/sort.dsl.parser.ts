import {
  SortDir,
  SortDslParseError,
  SortShorthandSpec,
  SortSpec,
} from './sort.dsl.types';

export type SortParseOptions<TField extends string> = {
  normalizeField: (raw: string) => TField | null;
  shorthand?: SortShorthandSpec<TField>[];
  sortFieldKey?: string;
  sortDirKey?: string;
  defaultDir?: SortDir;
};

export function readSortStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  const values = Array.isArray(value) ? value : [value];
  const out: string[] = [];

  for (const item of values) {
    if (item === null || item === undefined) continue;
    const token = String(item);
    const parts = token
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    out.push(...parts);
  }

  return out;
}

export function hasSortQueryValue(value: unknown): boolean {
  return readSortStringList(value).length > 0;
}

export function readFirstSortString(value: unknown): string | null {
  const list = readSortStringList(value);
  return list[0] ?? null;
}

export function normalizeSortDir(
  raw: unknown,
  fieldName = 'sort_dir',
): SortDir {
  const value = readFirstSortString(raw);
  if (!value) return 'asc';

  const normalized = value.trim().toLowerCase();
  if (normalized === 'asc' || normalized === '오름차순') return 'asc';
  if (normalized === 'desc' || normalized === '내림차순') return 'desc';

  throw new SortDslParseError(`${fieldName} 값은 asc 또는 desc만 허용됩니다.`);
}

export function parseSortSpecs<TField extends string>(
  raw: Record<string, unknown>,
  options: SortParseOptions<TField>,
): Array<SortSpec<TField>> {
  const {
    normalizeField,
    shorthand = [],
    sortFieldKey = 'sort_field',
    sortDirKey = 'sort_dir',
    defaultDir = 'asc',
  } = options;

  const requested: Array<SortSpec<TField>> = [];
  const fieldList = readSortStringList(raw[sortFieldKey]);
  const dirList = readSortStringList(raw[sortDirKey]);

  if (fieldList.length > 0) {
    if (dirList.length > 1 && dirList.length !== fieldList.length) {
      throw new SortDslParseError(
        `${sortDirKey}를 여러 개 보낼 때는 ${sortFieldKey} 개수와 같아야 합니다.`,
      );
    }

    fieldList.forEach((fieldRaw, idx) => {
      const field = normalizeField(fieldRaw);
      if (!field) {
        throw new SortDslParseError(
          `지원하지 않는 ${sortFieldKey} 입니다: ${fieldRaw}`,
        );
      }

      const dirRaw =
        dirList[idx] ?? (dirList.length === 1 ? dirList[0] : undefined);

      requested.push({
        field,
        dir: dirRaw ? normalizeSortDir(dirRaw, sortDirKey) : defaultDir,
      });
    });
  }

  for (const { key, field } of shorthand) {
    if (!hasSortQueryValue(raw[key])) continue;
    requested.push({
      field,
      dir: normalizeSortDir(raw[key], key),
    });
  }

  const deduped: Array<SortSpec<TField>> = [];
  const seen = new Set<TField>();
  for (const spec of requested) {
    if (seen.has(spec.field)) continue;
    seen.add(spec.field);
    deduped.push(spec);
  }

  return deduped;
}
