import type { TokenUsageSummary, TokenUsageDetails, AllAgentsTokenUsage } from '../../types';
import client from './client';

export const tokenUsageApi = {
  getAll: () =>
    client.get<{ all_usage: AllAgentsTokenUsage }>('/token-usage'),

  get: (agentId: string) =>
    client.get<TokenUsageDetails>(`/token-usage/${agentId}`),

  reset: (agentId: string) =>
    client.post<{ status: string; message: string }>(`/token-usage/${agentId}/reset`),
};
