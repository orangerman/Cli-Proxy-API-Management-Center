import { describe, expect, test } from 'bun:test';
import { presetUsageDates, usageDateRange } from '@/features/dashboard/usageRange';

describe('dashboard usage calendar range', () => {
  test('includes today and the final selected day in each preset', () => {
    const now = new Date(2026, 9, 29, 13, 0);
    expect(presetUsageDates('today', now)).toEqual({ start: '2026-10-29', end: '2026-10-29' });
    expect(presetUsageDates('7d', now)).toEqual({ start: '2026-10-23', end: '2026-10-29' });
    expect(presetUsageDates('30d', now)).toEqual({ start: '2026-09-30', end: '2026-10-29' });
    const range = usageDateRange('2026-10-29', '2026-10-29')!;
    expect(new Date(range.from).getHours()).toBe(0);
    expect(new Date(range.to).getDate()).toBe(30);
    expect(new Date(range.to).getHours()).toBe(0);
  });

  test('rejects impossible, reversed, missing, and excessive ranges', () => {
    expect(usageDateRange('2026-02-30', '2026-03-01')).toBeNull();
    expect(usageDateRange('2026-10-30', '2026-10-29')).toBeNull();
    expect(usageDateRange('', '2026-10-29')).toBeNull();
    expect(usageDateRange('2024-01-01', '2026-10-29')).toBeNull();
  });
});
