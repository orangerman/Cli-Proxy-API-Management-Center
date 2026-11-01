import { describe, expect, test } from 'bun:test';
import { selectQuotaAutoLoadTargets } from '@/features/quota/autoLoad';
import type { QuotaFileEntry } from '@/features/quota/logic';

const entries: QuotaFileEntry[] = ['codex', 'claude', 'devin', 'kimi'].map((type) => ({
  type: type as QuotaFileEntry['type'],
  file: { name: `${type}.json`, provider: type },
}));

describe('missing quota automatic loading', () => {
  test('loads missing and failed quotas across providers, preserving success and in-flight work', () => {
    const statuses = [undefined, 'error', 'success', 'loading'];
    const attempted = new Set<string>();
    const select = () =>
      selectQuotaAutoLoadTargets(
        entries,
        attempted,
        1,
        {},
        (entry) => statuses[entries.indexOf(entry)]
      );
    expect(select()).toEqual(entries.slice(0, 2));
    expect(select()).toEqual([]);
  });

  test('loads newly visible entries once and permits a new visit or invalidated session', () => {
    const attempted = new Set<string>();
    const select = (visible: QuotaFileEntry[], session = 1, generations = {}) =>
      selectQuotaAutoLoadTargets(visible, attempted, session, generations, () => undefined);
    expect(select(entries.slice(0, 1))).toEqual(entries.slice(0, 1));
    expect(select(entries)).toEqual(entries.slice(1));
    expect(select(entries)).toEqual([]);
    expect(select(entries, 2)).toEqual(entries);
    expect(select(entries, 2, { 'codex.json': 1 })).toEqual(entries.slice(0, 1));
    expect(selectQuotaAutoLoadTargets(entries, new Set(), 2, {}, () => undefined)).toEqual(entries);
  });

  test('does not request disabled credentials', () => {
    const disabled = [{ ...entries[0], file: { ...entries[0].file, disabled: true } }];
    expect(selectQuotaAutoLoadTargets(disabled, new Set(), 1, {}, () => undefined)).toEqual([]);
  });
});
