import { describe, expect, test } from 'bun:test';
import { groupQuotaEntries, paginate, type QuotaFileEntry } from '@/features/quota/logic';

const entry = (type: QuotaFileEntry['type'], name: string): QuotaFileEntry => ({
  type,
  file: { name },
});

describe('quota list provider groups', () => {
  test('does not regroup a globally sorted list or lose repeated providers', () => {
    const entries = [entry('claude', 'a'), entry('codex', 'b'), entry('claude', 'c')];
    const groups = groupQuotaEntries(entries);
    expect(groups.flatMap((group) => group.entries)).toEqual(entries);
    expect(groups.map((group) => group.startIndex)).toEqual([0, 1, 2]);
  });

  test('only counts and renders credentials from the current page', () => {
    const entries = [
      entry('claude', 'a'),
      entry('claude', 'b'),
      entry('codex', 'c'),
      entry('codex', 'd'),
    ];
    const groups = groupQuotaEntries(paginate(entries, 2, 2).pageItems);
    expect(groups).toEqual([{ type: 'codex', entries: entries.slice(2), startIndex: 0 }]);
    expect(groupQuotaEntries([])).toEqual([]);
    expect(entries).toHaveLength(4);
  });
});
