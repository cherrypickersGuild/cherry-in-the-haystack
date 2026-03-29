import {
  FilterDslParseError,
  NumericFilterParseOptions,
  NumericFilterRawQuery,
  NumericFilterSpec,
  NumericOperator,
} from './filter.dsl.types';

function readStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  const out: string[] = [];

  for (const item of values) {
    if (item === null || item === undefined) continue;
    const token = String(item);
    const parts = token
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    out.push(...parts);
  }

  return out;
}

function hasQueryValue(value: unknown): boolean {
  return readStringList(value).length > 0;
}

function normalizeOperator(raw: string): NumericOperator {
  const s = raw.trim().toLowerCase();

  if (s === '이상' || s === 'gte' || s === '>=' || s === 'ge') return 'gte';
  if (s === '이하' || s === 'lte' || s === '<=' || s === 'le') return 'lte';
  if (s === '초과' || s === 'gt' || s === '>' || s === 'g') return 'gt';
  if (s === '미만' || s === 'lt' || s === '<' || s === 'l') return 'lt';

  throw new FilterDslParseError(
    `지원하지 않는 연산자입니다: ${raw} (허용: 이상/이하/초과/미만)`,
  );
}

function readOperatorList(raw: unknown, label: string): NumericOperator[] {
  const values = readStringList(raw);
  if (values.length === 0) return [];
  return values.map((v) => {
    try {
      return normalizeOperator(v);
    } catch {
      throw new FilterDslParseError(`${label}가 올바르지 않습니다: ${v}`);
    }
  });
}

function readNumberList(raw: unknown, label: string): number[] {
  const values = readStringList(raw);
  if (values.length === 0) return [];

  return values.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      throw new FilterDslParseError(
        `${label}에 숫자가 아닌 값이 포함되어 있습니다: ${v}`,
      );
    }
    return n;
  });
}

function buildRangeFilter(
  values: [number, number] | number[],
  ops: [NumericOperator, NumericOperator] | NumericOperator[],
  label: string,
): NumericFilterSpec {
  if (values.length !== 2 || ops.length !== 2) {
    throw new FilterDslParseError(
      `${label} 범위 필터는 값 2개, 연산자 2개가 필요합니다.`,
    );
  }

  const pair = [
    { value: values[0], op: ops[0] },
    { value: values[1], op: ops[1] },
  ].sort((a, b) => a.value - b.value);

  const lower = pair[0];
  const upper = pair[1];

  if (!['gte', 'gt'].includes(lower.op)) {
    throw new FilterDslParseError(
      `${label}의 작은 값 연산자는 이상 또는 초과만 허용됩니다.`,
    );
  }
  if (!['lte', 'lt'].includes(upper.op)) {
    throw new FilterDslParseError(
      `${label}의 큰 값 연산자는 이하 또는 미만만 허용됩니다.`,
    );
  }

  return {
    kind: 'range',
    lower: { value: lower.value, op: lower.op as 'gte' | 'gt' },
    upper: { value: upper.value, op: upper.op as 'lte' | 'lt' },
  };
}

export function parseNumericFilter(
  raw: NumericFilterRawQuery,
  options: NumericFilterParseOptions,
): NumericFilterSpec | null {
  const { field, label } = options;

  const hasValuesMode = hasQueryValue(raw[`${field}_values`]);
  const hasSingleMode = hasQueryValue(raw[`${field}_value`]);
  const hasRangeMode =
    hasQueryValue(raw[`${field}_min`]) || hasQueryValue(raw[`${field}_max`]);

  const modeCount = [hasValuesMode, hasSingleMode, hasRangeMode].filter(
    Boolean,
  ).length;

  if (modeCount === 0) return null;
  if (modeCount > 1) {
    throw new FilterDslParseError(
      `${label} 필터 형식이 충돌합니다. (values/value/min-max 중 하나만 사용)`,
    );
  }

  if (hasValuesMode) {
    const values = readNumberList(raw[`${field}_values`], `${label} 값`);
    if (values.length < 1 || values.length > 2) {
      throw new FilterDslParseError(`${label} 값은 1개 또는 2개만 허용됩니다.`);
    }

    const ops = readOperatorList(raw[`${field}_ops`], `${label} 연산자`);
    if (values.length === 1) {
      if (ops.length !== 1) {
        throw new FilterDslParseError(
          `${label} 값이 1개일 때 연산자도 1개(이상/이하/초과/미만)여야 합니다.`,
        );
      }
      return {
        kind: 'single',
        op: ops[0],
        value: values[0],
      };
    }

    if (ops.length !== 2) {
      throw new FilterDslParseError(
        `${label} 값이 2개일 때 연산자도 2개(이상/이하/초과/미만)여야 합니다.`,
      );
    }
    return buildRangeFilter(values, ops, label);
  }

  if (hasSingleMode) {
    const value = readNumberList(raw[`${field}_value`], `${label} 값`);
    if (value.length !== 1) {
      throw new FilterDslParseError(
        `${label} 단일 필터는 ${field}_value 1개가 필요합니다.`,
      );
    }

    const ops = readOperatorList(raw[`${field}_op`], `${label} 연산자`);
    if (ops.length !== 1) {
      throw new FilterDslParseError(
        `${label} 단일 값에는 연산자 1개(이상/이하/초과/미만)가 필요합니다.`,
      );
    }
    return {
      kind: 'single',
      op: ops[0],
      value: value[0],
    };
  }

  const min = readNumberList(raw[`${field}_min`], `${label} 최소값`);
  const max = readNumberList(raw[`${field}_max`], `${label} 최대값`);
  if (min.length !== 1 || max.length !== 1) {
    throw new FilterDslParseError(
      `${label} 범위 필터는 ${field}_min/${field}_max 각각 1개가 필요합니다.`,
    );
  }

  const minOpList = readOperatorList(
    raw[`${field}_min_op`],
    `${label} 최소 연산자`,
  );
  const maxOpList = readOperatorList(
    raw[`${field}_max_op`],
    `${label} 최대 연산자`,
  );

  if (minOpList.length !== 1 || maxOpList.length !== 1) {
    throw new FilterDslParseError(
      `${label} min/max 연산자는 각각 1개(이상/이하/초과/미만)씩 필요합니다.`,
    );
  }

  return buildRangeFilter(
    [min[0], max[0]],
    [minOpList[0], maxOpList[0]],
    label,
  );
}
