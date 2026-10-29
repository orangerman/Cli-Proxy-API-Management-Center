import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/stores';
import { apiClient } from '@/services/api/client';
import { usageSummaryApi, type UsageSummary } from '@/services/api/usageSummary';
import {
  localDateValue,
  presetUsageDates,
  usageDateRange,
  USAGE_PERIODS,
  type UsagePeriod,
} from '../usageRange';
import styles from './ModelUsage.module.scss';

const PRICE_SOURCES = [
  ['OpenAI', 'https://developers.openai.com/api/docs/pricing'],
  ['Anthropic', 'https://platform.claude.com/docs/en/about-claude/pricing'],
  ['Google', 'https://ai.google.dev/gemini-api/docs/pricing'],
  ['xAI', 'https://docs.x.ai/developers/pricing'],
] as const;

export function ModelUsage({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { t, i18n } = useTranslation();
  const connected = useAuthStore((state) => state.connectionStatus === 'connected');
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const [period, setPeriod] = useState<UsagePeriod>('7d');
  const [dates, setDates] = useState(() => presetUsageDates('7d'));
  const [clientIP, setClientIP] = useState('');
  const [result, setResult] = useState<{
    revision: number;
    rangeKey: string;
    clientIP: string;
    data: UsageSummary;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestRef = useRef(0);
  const range = useMemo(() => usageDateRange(dates.start, dates.end), [dates]);
  const rangeKey = range ? `${range.from}/${range.to}` : '';
  const revision = apiClient.getConnectionRevision();
  const data =
    connected &&
    result?.revision === revision &&
    result.rangeKey === rangeKey &&
    result.clientIP === clientIP
      ? result.data
      : null;
  const availableIPs =
    connected && result?.revision === revision && result.rangeKey === rangeKey
      ? result.data.clientIPs
      : [];
  const ipOptions = [
    { value: '', label: t('dashboard_usage.all_ips') },
    ...Array.from(new Set([...availableIPs, ...(clientIP ? [clientIP] : [])])).map((ip) => ({
      value: ip,
      label: ip,
    })),
  ];

  const refresh = useCallback(() => setRefreshVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestRef.current;
    if (!connected || !range) {
      setLoading(false);
      return;
    }
    const connectionRevision = apiClient.getConnectionRevision();
    const isCurrent = () =>
      request === requestRef.current &&
      !controller.signal.aborted &&
      connectionRevision === apiClient.getConnectionRevision();
    setLoading(true);
    setError(false);
    void usageSummaryApi
      .get(range.from, range.to, clientIP, controller.signal)
      .then((next) => {
        if (isCurrent())
          setResult({ revision: connectionRevision, rangeKey, clientIP, data: next });
      })
      .catch(() => {
        if (isCurrent()) {
          setResult(null);
          setError(true);
        }
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => {
      controller.abort();
      requestRef.current += 1;
    };
  }, [connected, apiBase, managementKey, range, rangeKey, clientIP, refreshVersion, refreshSignal]);

  const totals = useMemo(
    () =>
      (data?.models ?? []).reduce(
        (sum, row) => ({
          requests: sum.requests + row.requests,
          tokens: sum.tokens + row.totalTokens,
          cost: sum.cost + row.estimatedCostUsd,
          unpriced: sum.unpriced + row.unpricedRequests,
        }),
        { requests: 0, tokens: 0, cost: 0, unpriced: 0 }
      ),
    [data]
  );
  const count = (value: number) => value.toLocaleString(i18n.resolvedLanguage);
  const money = (value: number) =>
    new Intl.NumberFormat(i18n.resolvedLanguage, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  const dash = '—';

  return (
    <section className={styles.section} aria-labelledby="model-usage-title" aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <h1 id="model-usage-title">{t('dashboard_usage.title')}</h1>
          <p>{t('dashboard_usage.description')}</p>
        </div>
        <button
          className={styles.refresh}
          type="button"
          onClick={refresh}
          disabled={!connected || loading || !range}
        >
          <IconRefreshCw size={14} />
          {t('common.refresh')}
        </button>
      </header>
      <div className={styles.filters}>
        <div className={styles.periods} role="group" aria-label={t('dashboard_usage.period')}>
          {USAGE_PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => {
                setPeriod(value);
                if (value !== 'custom') setDates(presetUsageDates(value));
              }}
            >
              {t(`dashboard_usage.period_${value}`)}
            </button>
          ))}
        </div>
        <div className={styles.dates}>
          <label>
            {t('dashboard_usage.from')}
            <input
              type="date"
              value={dates.start}
              max={dates.end}
              onChange={(event) => {
                setPeriod('custom');
                setDates((prev) => ({ ...prev, start: event.target.value }));
              }}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            {t('dashboard_usage.to')}
            <input
              type="date"
              value={dates.end}
              min={dates.start}
              max={localDateValue(new Date())}
              onChange={(event) => {
                setPeriod('custom');
                setDates((prev) => ({ ...prev, end: event.target.value }));
              }}
            />
          </label>
        </div>
        <div className={styles.ipFilter}>
          <span>{t('dashboard_usage.client_ip')}</span>
          <Select
            value={clientIP}
            options={ipOptions}
            onChange={setClientIP}
            ariaLabel={t('dashboard_usage.client_ip')}
          />
        </div>
      </div>
      {!range && (
        <p className={styles.notice} role="alert">
          {t('dashboard_usage.invalid_range')}
        </p>
      )}
      {error && (
        <p className={styles.notice} role="alert">
          {t('dashboard_usage.error')}
        </p>
      )}
      {data && !data.recordingEnabled && (
        <p className={styles.notice}>{t('dashboard_usage.recording_disabled')}</p>
      )}
      <div className={styles.totals}>
        <div>
          <span>{t('dashboard_usage.requests')}</span>
          <strong>{data ? count(totals.requests) : dash}</strong>
        </div>
        <div>
          <span>{t('dashboard_usage.total_tokens')}</span>
          <strong>{data ? count(totals.tokens) : dash}</strong>
        </div>
        <div>
          <span>{t('dashboard_usage.cost')}</span>
          <strong>{data && totals.requests > totals.unpriced ? money(totals.cost) : dash}</strong>
          {data && totals.unpriced > 0 && (
            <small>{t('dashboard_usage.unpriced', { count: totals.unpriced })}</small>
          )}
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('dashboard_usage.model')}</th>
              <th scope="col">{t('dashboard_usage.requests')}</th>
              <th scope="col">{t('dashboard_usage.input')}</th>
              <th scope="col">{t('dashboard_usage.output')}</th>
              <th scope="col">{t('dashboard_usage.cache_read')}</th>
              <th scope="col">{t('dashboard_usage.cache_write')}</th>
              <th scope="col">{t('dashboard_usage.total_tokens')}</th>
              <th scope="col">{t('dashboard_usage.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.models ?? []).map((row) => (
              <tr key={row.model}>
                <th scope="row" title={row.model}>
                  {row.model}
                </th>
                <td>{count(row.requests)}</td>
                <td>{count(row.inputTokens)}</td>
                <td
                  title={t('dashboard_usage.reasoning_detail', {
                    count: count(row.reasoningTokens),
                  })}
                >
                  {count(row.outputTokens)}
                </td>
                <td>{count(row.cacheReadTokens)}</td>
                <td>{count(row.cacheWriteTokens)}</td>
                <td>
                  {count(row.totalTokens)}
                  {row.unclassifiedTokens > 0 && (
                    <small>
                      {t('dashboard_usage.unclassified', { count: count(row.unclassifiedTokens) })}
                    </small>
                  )}
                </td>
                <td>
                  {row.requests > row.unpricedRequests ? money(row.estimatedCostUsd) : dash}
                  {row.unpricedRequests > 0 && (
                    <small>{t('dashboard_usage.unpriced', { count: row.unpricedRequests })}</small>
                  )}
                </td>
              </tr>
            ))}
            {!data?.models.length && (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  {loading ? t('common.loading') : error ? dash : t('dashboard_usage.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className={styles.footer}>
        <p>{t('dashboard_usage.accounting_note')}</p>
        <p>
          {t('dashboard_usage.history_note')}
          {data?.historyStart &&
            ` · ${t('dashboard_usage.history_start', { date: data.historyStart })}`}
        </p>
        <p>{t('dashboard_usage.ip_note')}</p>
        <p>
          {t('dashboard_usage.pricing_note', { date: data?.pricingDate || dash })}{' '}
          {PRICE_SOURCES.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer">
              {name}
            </a>
          ))}
        </p>
      </footer>
    </section>
  );
}
