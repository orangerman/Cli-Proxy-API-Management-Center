import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export interface ModelUsageSummary {
  model: string;
  requests: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  unclassifiedTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  unpricedRequests: number;
}

export interface UsageSummary {
  models: ModelUsageSummary[];
  pricingDate: string;
  historyStart: string;
  recordingEnabled: boolean;
  clientIPs: string[];
}

const numberField = (row: Record<string, unknown>, key: string): number => {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid usage summary field: ${key}`);
  }
  return value;
};

export function normalizeUsageSummary(data: unknown): UsageSummary {
  if (!isRecord(data) || !Array.isArray(data.models)) {
    throw new Error('Invalid usage summary response');
  }
  if (
    data.client_ips !== undefined &&
    (!Array.isArray(data.client_ips) ||
      data.client_ips.some((ip: unknown) => typeof ip !== 'string' || !ip.trim()))
  ) {
    throw new Error('Invalid usage summary IP addresses');
  }
  return {
    models: data.models.map((row) => {
      if (!isRecord(row) || typeof row.model !== 'string' || !row.model.trim()) {
        throw new Error('Invalid usage summary model');
      }
      return {
        model: row.model,
        requests: numberField(row, 'requests'),
        failed: numberField(row, 'failed'),
        inputTokens: numberField(row, 'input_tokens'),
        outputTokens: numberField(row, 'output_tokens'),
        cacheReadTokens: numberField(row, 'cache_read_tokens'),
        cacheWriteTokens: numberField(row, 'cache_write_tokens'),
        reasoningTokens: numberField(row, 'reasoning_tokens'),
        unclassifiedTokens: numberField(row, 'unclassified_tokens'),
        totalTokens: numberField(row, 'total_tokens'),
        estimatedCostUsd: numberField(row, 'estimated_cost_usd'),
        unpricedRequests: numberField(row, 'unpriced_requests'),
      };
    }),
    pricingDate: typeof data.pricing_date === 'string' ? data.pricing_date : '',
    historyStart: typeof data.history_start === 'string' ? data.history_start : '',
    recordingEnabled: data.recording_enabled === true,
    clientIPs: (data.client_ips as string[] | undefined) ?? [],
  };
}

export const usageSummaryApi = {
  async get(from: string, to: string, clientIP = '', signal?: AbortSignal): Promise<UsageSummary> {
    const data = await apiClient.get('/observability/usage/summary', {
      params: { from, to, ...(clientIP ? { client_ip: clientIP } : {}) },
      signal,
    });
    return normalizeUsageSummary(data);
  },
};
