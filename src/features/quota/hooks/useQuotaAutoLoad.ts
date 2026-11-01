import { useEffect, useRef } from 'react';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from '../logic';
import { QUOTA_ADAPTERS } from '../providers';
import { selectQuotaAutoLoadTargets } from '../autoLoad';

/** Load missing visible quotas once per visit, without polling or automatic retries. */
export function useQuotaAutoLoad(
  entries: QuotaFileEntry[],
  disabled: boolean,
  loadQuota: (targets: QuotaFileEntry[]) => Promise<void>
) {
  const attempted = useRef(new Set<string>());
  const session = useQuotaStore((state) => state.cacheGeneration);
  const fileGenerations = useQuotaStore((state) => state.fileGenerations);

  useEffect(() => {
    if (disabled) return;
    const targets = selectQuotaAutoLoadTargets(
      entries,
      attempted.current,
      session,
      fileGenerations,
      (entry) =>
        QUOTA_ADAPTERS[entry.type].storeSelector(useQuotaStore.getState())[
          getQuotaCacheKey(entry.file)
        ]?.status
    );
    if (targets.length > 0) void loadQuota(targets);
  }, [disabled, entries, fileGenerations, loadQuota, session]);
}
