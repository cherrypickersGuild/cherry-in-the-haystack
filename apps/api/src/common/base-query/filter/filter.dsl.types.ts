export type NumericOperator = 'gte' | 'lte' | 'gt' | 'lt';

export type NumericSingleFilterSpec = {
  kind: 'single';
  op: NumericOperator;
  value: number;
};

export type NumericRangeFilterSpec = {
  kind: 'range';
  lower: { value: number; op: 'gte' | 'gt' };
  upper: { value: number; op: 'lte' | 'lt' };
};

export type NumericFilterSpec =
  | NumericSingleFilterSpec
  | NumericRangeFilterSpec;

export type NumericFilterRawQuery = Record<string, unknown>;

export type NumericFilterParseOptions = {
  field: string;
  label: string;
};

export class FilterDslParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterDslParseError';
  }
}
