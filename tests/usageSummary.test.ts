import { describe, expect, test } from 'bun:test';
import { normalizeUsageSummary } from '@/services/api/usageSummary';

const row = {
  model: 'gpt-6.1-sol',
  requests: 2,
  failed: 0,
  input_tokens: 100,
  output_tokens: 40,
  cache_read_tokens: 30,
  cache_write_tokens: 0,
  reasoning_tokens: 10,
  unclassified_tokens: 0,
  total_tokens: 140,
  estimated_cost_usd: 0.000543,
  unpriced_requests: 0,
};

describe('usage summary API normalization', () => {
  test('preserves disjoint token fields and recording status', () => {
    const result = normalizeUsageSummary({
      models: [row],
      recording_enabled: false,
      pricing_date: '2026-10-29',
      history_start: '2026-10-28',
      client_ips: ['127.0.0.1', '2001:db8::1'],
    });
    expect(result.recordingEnabled).toBe(false);
    expect(result.historyStart).toBe('2026-10-28');
    expect(result.clientIPs).toEqual(['127.0.0.1', '2001:db8::1']);
    expect(result.models[0]).toMatchObject({
      model: row.model,
      inputTokens: 100,
      outputTokens: 40,
      cacheReadTokens: 30,
      reasoningTokens: 10,
      totalTokens: 140,
      estimatedCostUsd: row.estimated_cost_usd,
    });
  });

  test('rejects malformed usage instead of presenting it as zero', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, '100', undefined]) {
      expect(() => normalizeUsageSummary({ models: [{ ...row, total_tokens: value }] })).toThrow();
    }
    expect(() => normalizeUsageSummary({ models: [{ ...row, model: ' ' }] })).toThrow();
    expect(() => normalizeUsageSummary({ models: null })).toThrow();
    expect(normalizeUsageSummary({ models: [] }).models).toEqual([]);
    expect(normalizeUsageSummary({ models: [] }).clientIPs).toEqual([]);
    expect(() => normalizeUsageSummary({ models: [], client_ips: [null] })).toThrow();
  });
});
