import { formatKstYmd, shiftKstYmd } from './date.util';
import {
  resolveInclusiveDateWindow,
  resolveKstBaseDate,
  resolveRollingEndDate,
} from './date-window.util';

describe('date.util (KST)', () => {
  it('formats KST date across UTC boundary correctly', () => {
    expect(formatKstYmd(new Date('2026-03-01T14:59:59Z'))).toBe('2026-03-01');
    expect(formatKstYmd(new Date('2026-03-01T15:00:00Z'))).toBe('2026-03-02');
  });

  it('shifts KST YYYY-MM-DD deterministically', () => {
    expect(shiftKstYmd('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftKstYmd('2026-03-01', 1)).toBe('2026-03-02');
  });
});

describe('date-window.util (KST)', () => {
  it('resolves base date from now using KST', () => {
    const nowUtc = new Date('2026-03-01T15:00:00Z'); // KST: 2026-03-02 00:00:00
    expect(resolveKstBaseDate(undefined, nowUtc)).toBe('2026-03-02');
  });

  it('builds inclusive windows and rolling end date', () => {
    expect(resolveRollingEndDate('2026-03-01')).toBe('2026-02-28');
    expect(resolveInclusiveDateWindow('2026-02-28', 30)).toEqual({
      startDate: '2026-01-30',
      endDate: '2026-02-28',
    });
  });
});
