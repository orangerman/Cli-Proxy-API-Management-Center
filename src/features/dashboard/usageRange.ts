export const USAGE_PERIODS = ['today', '7d', '30d', 'custom'] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function presetUsageDates(period: Exclude<UsagePeriod, 'custom'>, now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - (period === 'today' ? 0 : period === '7d' ? 6 : 29));
  return { start: localDateValue(start), end: localDateValue(now) };
}

/** Inclusive local calendar dates become an exclusive UTC endpoint, including DST changes. */
export function usageDateRange(start: string, end: string): { from: string; to: string } | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return localDateValue(date) === value ? date : null;
  };
  const from = parse(start);
  const to = parse(end);
  if (!from || !to || from > to) return null;
  to.setDate(to.getDate() + 1);
  if (to.getTime() - from.getTime() > 366 * 86_400_000) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}
