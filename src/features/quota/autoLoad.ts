import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from './logic';

/** Select each visible credential at most once per visit and cache generation. */
export function selectQuotaAutoLoadTargets(
  entries: QuotaFileEntry[],
  attempted: Set<string>,
  session: number,
  fileGenerations: Record<string, number>,
  statusFor: (entry: QuotaFileEntry) => string | undefined
): QuotaFileEntry[] {
  return entries.filter((entry) => {
    const { type, file } = entry;
    if (file.disabled) return false;
    const key = JSON.stringify([
      session,
      fileGenerations[file.name] ?? 0,
      type,
      getQuotaCacheKey(file),
    ]);
    if (attempted.has(key)) return false;
    attempted.add(key);
    const status = statusFor(entry);
    return status !== 'success' && status !== 'loading';
  });
}
