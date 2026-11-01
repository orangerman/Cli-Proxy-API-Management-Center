import { afterEach, expect, test } from 'bun:test';
import i18n from '@/i18n';
import type { AuthFileItem } from '@/types';
import { apiCallApi, type ApiCallResult } from '@/services/api';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { CODEX_CONFIG } from '@/features/quota/providers/codex/data';
import type { QuotaAdapter } from '@/features/quota/providers';
import { enrichQuotaInBackground } from '@/features/quota/quotaEnrichment';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { CODEX_USAGE_URL, CODEX_SUBSCRIPTION_URL } from '@/utils/quota';

const originalRequest = apiCallApi.request;
const file: AuthFileItem = {
  name: 'fixture.json',
  type: 'codex',
  auth_index: 'fixture',
  chatgpt_account_id: 'account',
  chatgpt_subscription_active_until: '2027-01-01T00:00:00Z',
};
const key = getQuotaCacheKey(file);
const adapter = CODEX_CONFIG as unknown as QuotaAdapter;
const result = (body: unknown, statusCode = 200): ApiCallResult => ({
  statusCode,
  body,
  bodyText: JSON.stringify(body),
  header: {},
});
const usage = {
  plan_type: 'plus',
  rate_limit: {
    primary_window: {
      used_percent: 25,
      limit_window_seconds: 18000,
      reset_at: 2000000000,
    },
  },
};
const current = () => useQuotaStore.getState().codexQuota[key];
const deferred = () => {
  let resolve!: (value: ApiCallResult) => void;
  const promise = new Promise<ApiCallResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
afterEach(() => {
  apiCallApi.request = originalRequest;
  useQuotaStore.getState().clearQuotaCache();
});

test('renders usage before optional requests and runs both optional probes concurrently', async () => {
  const subscription = deferred();
  const credits = deferred();
  const urls: string[] = [];
  apiCallApi.request = async (request, config) => {
    urls.push(request.url);
    if (request.url === CODEX_USAGE_URL) return result(usage);
    expect(current()?.status).toBe('success');
    expect(config?.timeout).toBe(8000);
    return request.url.startsWith(CODEX_SUBSCRIPTION_URL) ? subscription.promise : credits.promise;
  };
  const data = await CODEX_CONFIG.fetchQuota(file, i18n.t);
  expect(urls).toEqual([CODEX_USAGE_URL]);
  expect(data.windows.length).toBeGreaterThan(0);
  const state = CODEX_CONFIG.buildSuccessState(data);
  useQuotaStore.getState().setCodexQuota({ [key]: state });
  const pending = enrichQuotaInBackground(adapter, file, data, state, i18n.t);
  expect(urls).toHaveLength(3);
  expect(current()).toBe(state);
  subscription.resolve(result({}, 403));
  credits.resolve(result({ available_count: 2, credits: [] }));
  await pending;
  expect(current()).toMatchObject({
    status: 'success',
    windows: data.windows,
    subscriptionActiveUntil: file.chatgpt_subscription_active_until,
    rateLimitResetCreditsAvailableCount: 2,
  });
});

for (const change of ['session', 'file', 'new-result', 'refresh', 'failure'] as const) {
  test(`optional details preserve valid quota on ${change}`, async () => {
    apiCallApi.request = async () => result(usage);
    const data = await CODEX_CONFIG.fetchQuota(file, i18n.t);
    const state = CODEX_CONFIG.buildSuccessState(data);
    useQuotaStore.getState().setCodexQuota({ [key]: state });
    const gate = deferred();
    apiCallApi.request = async () => gate.promise;
    const pending = enrichQuotaInBackground(adapter, file, data, state, i18n.t);
    if (change === 'session') useQuotaStore.getState().clearQuotaCache();
    if (change === 'file') useQuotaStore.getState().clearQuotaCache([file.name]);
    if (change === 'new-result')
      useQuotaStore.getState().setCodexQuota({
        [key]: CODEX_CONFIG.buildSuccessState({ ...data, creditBalance: '42' }),
      });
    if (change === 'refresh')
      useQuotaStore.getState().setCodexQuota({
        [key]: CODEX_CONFIG.buildLoadingState(),
      });
    const expected = current();
    gate.resolve(change === 'failure' ? result({}, 503) : result({ available_count: 9 }));
    await pending;
    if (change === 'failure') {
      expect(current()?.status).toBe('success');
      expect(current()?.windows).toEqual(data.windows);
      expect(current()?.subscriptionActiveUntil).toBe(data.subscriptionActiveUntil);
    } else expect(current()).toBe(expected);
  });
}
