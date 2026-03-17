import type { Integration } from '../../types';
import client from './client';

export const integrationsApi = {
  list: () =>
    client.get<{ integrations: Integration[] }>('/integrations'),

  get: (integrationId: string) =>
    client.get<Integration>(`/integrations/${integrationId}`),

  create: (data: { name: string; url: string; provider: string; model?: string; key?: string; icon?: string }) =>
    client.post<{ status: string; integration: Integration }>('/integrations', data),

  update: (
    integrationId: string,
    data: { name?: string; url?: string; provider?: string; model?: string; key?: string; icon?: string; status?: 'active' | 'inactive' }
  ) =>
    client.put<{ status: string; integration: Integration }>(`/integrations/${integrationId}`, data),

  delete: (integrationId: string) =>
    client.delete<{ status: string; message: string }>(`/integrations/${integrationId}`),

  duplicate: (integrationId: string) =>
    client.post<{ status: string; integration: Integration }>(`/integrations/${integrationId}/duplicate`),

  reorder: (integrations: { id: string; order: number }[]) =>
    client.put<{ status: string; message: string }>('/integrations/reorder', { integrations }),
};
